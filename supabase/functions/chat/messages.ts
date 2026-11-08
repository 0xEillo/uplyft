import type { ModelMessage, UserContent } from 'npm:ai@7.0.162'

export type ChatHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatImage =
  | { type: 'image'; image: string; mediaType?: string }
  | { type: 'image'; image: URL; mediaType?: string }

/**
 * Builds the model-facing conversation (everything after the static system
 * prompt), in cache-friendly order:
 *
 *   [user snapshot] [history ... unchanged] [turn context + newest user text + images]
 *
 * Earlier messages are passed through byte-for-byte, so each request shares
 * its prefix with the previous one. Only the newest user message carries the
 * volatile turn context and any images.
 */
export function buildModelMessages(options: {
  snapshot?: string
  history: ChatHistoryMessage[]
  turnContext?: string
  images?: ChatImage[]
}): ModelMessage[] {
  const { snapshot, history, turnContext, images = [] } = options
  const lastUserIndex = findLastIndex(history, (m) => m.role === 'user')

  const messages: ModelMessage[] = history.map((message, index) => {
    if (message.role === 'assistant') {
      return { role: 'assistant', content: message.content }
    }

    const parts: UserContent = []
    // The snapshot leads the conversation. It joins the first user message
    // rather than standing alone so user/assistant turns still alternate.
    if (index === 0 && snapshot) parts.push({ type: 'text', text: snapshot })
    if (index === lastUserIndex && turnContext) {
      parts.push({ type: 'text', text: turnContext })
    }
    parts.push({ type: 'text', text: message.content })
    if (index === lastUserIndex) parts.push(...images)

    return parts.length === 1
      ? { role: 'user', content: message.content }
      : { role: 'user', content: parts }
  })

  // History that opens with an assistant turn (e.g. the welcome message)
  // gets the snapshot as its own leading user message.
  if (snapshot && history[0]?.role !== 'user') {
    messages.unshift({ role: 'user', content: snapshot })
  }

  return messages
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index
  }
  return -1
}
