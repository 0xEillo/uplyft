// deno-lint-ignore-file no-explicit-any
/**
 * Verifies the chat request is cache-friendly on the wire: each turn's
 * request body to OpenRouter extends the previous one instead of rewriting it.
 *
 * Runs offline: OpenRouter is replaced with a fake `fetch` that records the
 * request bodies the AI SDK actually sends.
 *
 *   deno test --allow-env supabase/functions/chat/caching_test.ts
 */
import {
  assert,
  assertEquals,
  assertNotEquals,
} from 'jsr:@std/assert@1.0.13'
import {
  createTextStreamResponse,
  generateText,
  streamText,
  toTextStream,
} from 'npm:ai@7.0.162'

import { trimChatMessagesForRequest } from '../../../lib/ai/chat-history.ts'
import { createChatCallOptions, MAX_STEPS } from './agent.ts'
import { buildModelMessages, type ChatHistoryMessage } from './messages.ts'
import { buildTurnContext, SYSTEM_PROMPT } from './prompt.ts'
import { createChatTools } from './tools/index.ts'

Deno.env.set('OPENROUTER_API_KEY', 'test-key')

type RecordedBody = {
  model: string
  models?: string[]
  messages: { role: string; content: unknown }[]
  tools?: { function: { name: string } }[]
}

const requests: RecordedBody[] = []

function completion(text: string) {
  return new Response(
    JSON.stringify({
      id: 'gen-1',
      model: 'google/gemini-3.1-flash-lite',
      choices: [
        { index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' },
      ],
      usage: {
        prompt_tokens: 6000,
        completion_tokens: 20,
        total_tokens: 6020,
        prompt_tokens_details: { cached_tokens: 5000 },
        cost: 0.0004,
      },
    }),
    { headers: { 'content-type': 'application/json' } },
  )
}

globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
  requests.push(JSON.parse(String(init?.body)))
  return Promise.resolve(completion(`reply ${requests.length}`))
}) as typeof fetch

// Tool definitions never touch the database until executed.
const tools = createChatTools({} as any, 'user-1', {} as any)
const SNAPSHOT_A = '<user_snapshot>\nUser: Alex (@alex)\n</user_snapshot>'
const SNAPSHOT_B = '<user_snapshot>\nUser: Sam (@sam)\n</user_snapshot>'

async function sendTurn(snapshot: string, history: ChatHistoryMessage[], today: string) {
  const messages = buildModelMessages({
    snapshot,
    history: trimChatMessagesForRequest(history) as ChatHistoryMessage[],
    turnContext: buildTurnContext({
      today,
    }),
  })
  const result = await generateText(createChatCallOptions({ messages, tools }))
  return { text: result.text, body: requests.at(-1)! }
}

/** Runs a conversation, returning the request body of every turn. */
async function runConversation(snapshot: string, userMessages: string[]) {
  const history: ChatHistoryMessage[] = [
    { role: 'assistant', content: "Hey. Let's plan your first workout together." },
  ]
  const bodies: RecordedBody[] = []
  for (const userMessage of userMessages) {
    history.push({ role: 'user', content: userMessage })
    const { text, body } = await sendTurn(snapshot, history, '2026-11-08')
    history.push({ role: 'assistant', content: text })
    bodies.push(body)
  }
  return bodies
}

Deno.test('static system prompt and tools lead every request', async () => {
  const [body] = await runConversation(SNAPSHOT_A, ['hi'])
  assertEquals(body.messages[0].role, 'system')
  assertEquals(JSON.stringify(body.messages[0].content), JSON.stringify([{ type: 'text', text: SYSTEM_PROMPT }]))
  const names = body.tools!.map((tool) => tool.function.name)
  assertEquals(names, [...names].sort())
  assertEquals(body.model, 'google/gemini-3.1-flash-lite')
  assertEquals(body.models, ['google/gemini-3.1-flash-lite', 'google/gemini-3.5-flash-lite'])
})

Deno.test('each turn extends the previous request (append-only prefix)', async () => {
  const bodies = await runConversation(SNAPSHOT_A, [
    'hi',
    'how was my last workout?',
    'what should I train today?',
    'make me a push day',
    'thanks!',
  ])

  for (let turn = 1; turn < bodies.length; turn += 1) {
    const previous = bodies[turn - 1]
    const current = bodies[turn]
    assertEquals(current.tools, previous.tools, `tools changed on turn ${turn + 1}`)

    // Everything up to (not including) the previous newest user message is
    // byte-identical. Only that message differs: it carried the turn context.
    const stablePrefix = previous.messages.length - 1
    assertEquals(
      JSON.stringify(current.messages.slice(0, stablePrefix)),
      JSON.stringify(previous.messages.slice(0, stablePrefix)),
      `prefix rewritten on turn ${turn + 1}`,
    )
  }
})

Deno.test('turn context rides only on the newest user message', async () => {
  const bodies = await runConversation(SNAPSHOT_A, ['hi', 'log 2 eggs'])
  // Skip the system prompt, which documents the <turn_context> tag.
  const conversation = JSON.stringify(bodies[1].messages.slice(1))
  assertEquals(conversation.split('<turn_context>').length - 1, 1)
  const newest = JSON.stringify(bodies[1].messages.at(-1))
  assert(newest.includes('<turn_context>'))
  assert(newest.includes('log 2 eggs'))
})

Deno.test('different users share the system prompt and tools, not the snapshot', async () => {
  const [alex] = await runConversation(SNAPSHOT_A, ['hi'])
  const [sam] = await runConversation(SNAPSHOT_B, ['hi'])
  assertEquals(alex.messages[0], sam.messages[0])
  assertEquals(alex.tools, sam.tools)
  assertNotEquals(alex.messages[1], sam.messages[1])
})

Deno.test('a new day only changes the newest message', async () => {
  const history: ChatHistoryMessage[] = [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hey' },
    { role: 'user', content: 'plan my week' },
  ]
  const monday = await sendTurn(SNAPSHOT_A, history, '2026-11-09')
  const tuesday = await sendTurn(SNAPSHOT_A, history, '2026-11-10')
  assertEquals(monday.body.messages.slice(0, -1), tuesday.body.messages.slice(0, -1))
  assertNotEquals(monday.body.messages.at(-1), tuesday.body.messages.at(-1))
})

Deno.test('usage summary reports cached tokens and cost', async () => {
  let summary: any
  const messages = buildModelMessages({
    snapshot: SNAPSHOT_A,
    history: [{ role: 'user', content: 'hi' }],
  })
  await generateText(
    createChatCallOptions({ messages, tools, onUsage: (usage) => (summary = usage) }),
  )
  assertEquals(summary.inputTokens, 6000)
  assertEquals(summary.cachedTokens, 5000)
  assertEquals(summary.cacheHitRate, 0.83)
  assertEquals(summary.costUsd, 0.0004)
  assertEquals(summary.steps, 1)
  assertEquals(summary.toolCalls, [])
})

Deno.test('streams plain text', async () => {
  const sse = (chunks: unknown[]) =>
    new Response(
      chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
        'data: [DONE]\n\n',
      { headers: { 'content-type': 'text/event-stream' } },
    )
  globalThis.fetch = (() =>
    Promise.resolve(
      sse([
        { id: 'g', model: 'm', choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello ' } }] },
        { id: 'g', model: 'm', choices: [{ index: 0, delta: { content: 'there' } }] },
        {
          id: 'g',
          model: 'm',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        },
      ]),
    )) as typeof fetch

  const result = streamText(
    createChatCallOptions({
      messages: buildModelMessages({ history: [{ role: 'user', content: 'hi' }] }),
      stream: true,
    }),
  )
  const response = createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  })
  assertEquals(await response.text(), 'Hello there')
})

Deno.test('a turn that keeps calling tools still ends with a written reply', async () => {
  const bodies: any[] = []
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    bodies.push(body)
    // Keep asking for tools until tool_choice forbids it.
    const message =
      body.tool_choice === 'none'
        ? { role: 'assistant', content: 'Here is your answer.' }
        : {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: `call-${bodies.length}`,
                type: 'function',
                function: { name: 'ping', arguments: '{}' },
              },
            ],
          }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: 'gen',
          model: 'm',
          choices: [
            {
              index: 0,
              message,
              finish_reason: body.tool_choice === 'none' ? 'stop' : 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    )
  }) as typeof fetch

  const { tool } = await import('npm:ai@7.0.162')
  const { z } = await import('npm:zod@3.25.76')
  const result = await generateText(
    createChatCallOptions({
      messages: buildModelMessages({ history: [{ role: 'user', content: 'plan my week' }] }),
      tools: {
        ping: tool({
          description: 'ping',
          inputSchema: z.object({}),
          execute: () => Promise.resolve({ ok: true }),
        }),
      },
    }),
  )

  assertEquals(result.text, 'Here is your answer.')
  assertEquals(bodies.length, MAX_STEPS)
  assertEquals(bodies.at(-1).tool_choice, 'none')
  // Tools are still sent on the final step, so the cached prefix is unchanged.
  assertEquals(bodies.at(-1).tools, bodies[0].tools)
})
