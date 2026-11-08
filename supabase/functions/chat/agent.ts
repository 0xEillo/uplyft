// deno-lint-ignore-file no-explicit-any
import {
  isStepCount,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type ProviderMetadata,
  type ToolSet,
} from 'npm:ai@7.0.162'

import { getChatModel } from '../_shared/openrouter.ts'
import { SYSTEM_PROMPT } from './prompt.ts'

/**
 * Hard cap on model steps (each tool round-trip is one step). The last step
 * has tools disabled so the turn always ends with a written reply.
 */
export const MAX_STEPS = 12

type UsageStep = {
  providerMetadata?: ProviderMetadata
  response: { modelId: string }
  toolCalls: { toolName: string }[]
}

export type ChatUsageSummary = {
  model: string | undefined
  steps: number
  inputTokens: number
  cachedTokens: number
  cacheHitRate: number
  outputTokens: number
  costUsd: number | null
  toolCalls: string[]
}

/**
 * Options shared by streamText and generateText for one chat turn.
 *
 * The request is laid out for prompt caching: tools (fixed order) and the
 * static SYSTEM_PROMPT form a prefix shared by every user; `messages` (built by
 * buildModelMessages) extend it per user and per turn.
 */
export function createChatCallOptions(options: {
  messages: ModelMessage[]
  tools?: ToolSet
  model?: LanguageModel
  /** Streaming responses also get a timeout between chunks. */
  stream?: boolean
  onUsage?: (usage: ChatUsageSummary) => void
}) {
  const { messages, tools, model = getChatModel(), stream = false, onUsage } =
    options
  return {
    model,
    instructions: SYSTEM_PROMPT,
    messages,
    tools,
    // Tool definitions sit at the front of the cached prefix: pin their order.
    toolOrder: tools ? Object.keys(tools).sort() : undefined,
    stopWhen: isStepCount(MAX_STEPS),
    // Out of tool budget: make the final step answer with what it has. Tools
    // stay in the request (only tool_choice changes) so the prefix is intact.
    prepareStep: ({ stepNumber }: { stepNumber: number }) =>
      stepNumber >= MAX_STEPS - 1 ? { toolChoice: 'none' as const } : undefined,
    maxRetries: 1,
    timeout: stream ? { totalMs: 60_000, chunkMs: 20_000 } : { totalMs: 60_000 },
    onEnd: ({ usage, steps }: { usage: LanguageModelUsage; steps: UsageStep[] }) =>
      onUsage?.(summarizeUsage(usage, steps)),
  }
}

/** Token usage for a whole turn, including how much was served from cache. */
export function summarizeUsage(
  usage: LanguageModelUsage,
  steps: UsageStep[],
): ChatUsageSummary {
  const inputTokens = usage.inputTokens ?? 0
  const cachedTokens = usage.inputTokenDetails?.cacheReadTokens ?? 0
  // `usage` is already summed across steps by the SDK; OpenRouter's cost is
  // reported per step.
  const costs = steps.map(
    (step) => (step.providerMetadata?.openrouter as any)?.usage?.cost,
  )
  return {
    model: steps.at(-1)?.response.modelId,
    steps: steps.length,
    inputTokens,
    cachedTokens,
    cacheHitRate:
      inputTokens > 0 ? Math.round((cachedTokens / inputTokens) * 100) / 100 : 0,
    outputTokens: usage.outputTokens ?? 0,
    costUsd: costs.length > 0 && costs.every((cost) => typeof cost === 'number')
      ? costs.reduce((total, cost) => total + cost, 0)
      : null,
    toolCalls: steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
  }
}
