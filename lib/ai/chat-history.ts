export type ChatHistoryMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TrimChatMessagesOptions {
  maxMessages?: number
  maxCharacters?: number
  preserveSystemMessages?: boolean
}

// Keep only a small recent window. In this app, chats are short and recent turns
// matter far more than deep history.
export const DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT = 10
export const DEFAULT_CHAT_HISTORY_CHARACTER_LIMIT = 8000

export function trimChatMessagesForRequest<T extends ChatHistoryMessage>(
  messages: readonly T[],
  options: TrimChatMessagesOptions = {},
): T[] {
  const {
    maxMessages = DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT,
    maxCharacters = DEFAULT_CHAT_HISTORY_CHARACTER_LIMIT,
    preserveSystemMessages = false,
  } = options

  const preservedSystemMessages = preserveSystemMessages
    ? messages.filter((message) => message.role === 'system')
    : []
  const candidates = preserveSystemMessages
    ? messages.filter((message) => message.role !== 'system')
    : [...messages]

  const trimmed: T[] = []
  let totalCharacters = 0

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const message = candidates[index]
    const nextMessageCount = trimmed.length + 1
    const nextCharacterCount = totalCharacters + message.content.length
    const isLatestMessage = trimmed.length === 0

    if (
      !isLatestMessage &&
      (nextMessageCount > maxMessages || nextCharacterCount > maxCharacters)
    ) {
      break
    }

    trimmed.push(message)
    totalCharacters = nextCharacterCount
  }

  return [...preservedSystemMessages, ...trimmed.reverse()]
}
