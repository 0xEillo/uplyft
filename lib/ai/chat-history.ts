export type ChatHistoryMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TrimChatMessagesOptions {
  maxMessages?: number
  maxCharacters?: number
  /** Messages are dropped from the front in blocks of this size. */
  dropChunkSize?: number
  preserveSystemMessages?: boolean
}

// Generous window: with prompt caching, older turns are cheap to resend, and
// dropping messages is what breaks the cache.
export const DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT = 40
export const DEFAULT_CHAT_HISTORY_CHARACTER_LIMIT = 40000
export const DEFAULT_CHAT_HISTORY_DROP_CHUNK_SIZE = 10

/**
 * Picks the slice of history to send to the model.
 *
 * Providers cache the longest identical prefix of a request, so the start of
 * the window must stay put for as long as possible. Instead of sliding the
 * window one message per turn (which changes the prefix on every request),
 * old messages are dropped in fixed-size blocks: the window start only moves
 * once every `dropChunkSize` messages, and between moves each request is the
 * previous one plus appended turns.
 *
 * The window always starts on a user message and always includes the newest
 * message.
 */
export function trimChatMessagesForRequest<T extends ChatHistoryMessage>(
  messages: readonly T[],
  options: TrimChatMessagesOptions = {},
): T[] {
  const {
    maxMessages = DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT,
    maxCharacters = DEFAULT_CHAT_HISTORY_CHARACTER_LIMIT,
    dropChunkSize = DEFAULT_CHAT_HISTORY_DROP_CHUNK_SIZE,
    preserveSystemMessages = false,
  } = options

  const preservedSystemMessages = preserveSystemMessages
    ? messages.filter((message) => message.role === 'system')
    : []
  const candidates = preserveSystemMessages
    ? messages.filter((message) => message.role !== 'system')
    : [...messages]

  const count = candidates.length
  if (count === 0) return [...preservedSystemMessages]

  const chunk = Math.max(1, Math.floor(dropChunkSize))
  const lastIndex = count - 1

  // Drop whole blocks until the message limit fits.
  let start =
    count > maxMessages ? Math.ceil((count - maxMessages) / chunk) * chunk : 0
  start = Math.min(start, lastIndex)

  // Keep dropping whole blocks until the character limit fits.
  const charactersFrom = (index: number) =>
    candidates
      .slice(index)
      .reduce((total, message) => total + message.content.length, 0)
  while (start < lastIndex && charactersFrom(start) > maxCharacters) {
    start = Math.min(start + chunk, lastIndex)
  }

  // Start on a user turn so the window never opens mid-exchange.
  while (start < lastIndex && candidates[start].role !== 'user') {
    start += 1
  }

  return [...preservedSystemMessages, ...candidates.slice(start)]
}
