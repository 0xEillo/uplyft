import {
  DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT,
  trimChatMessagesForRequest,
} from '@/lib/ai/chat-history'

describe('trimChatMessagesForRequest', () => {
  it('keeps the most recent messages in order when count limit is exceeded', () => {
    const messages = [
      { role: 'user' as const, content: 'u1' },
      { role: 'assistant' as const, content: 'a1' },
      { role: 'user' as const, content: 'u2' },
      { role: 'assistant' as const, content: 'a2' },
      { role: 'user' as const, content: 'u3' },
    ]

    expect(
      trimChatMessagesForRequest(messages, {
        maxMessages: 3,
        maxCharacters: 100,
      }),
    ).toEqual([
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' },
    ])
  })

  it('trims older messages by character budget but always keeps the latest message', () => {
    const messages = [
      { role: 'user' as const, content: 'first' },
      { role: 'assistant' as const, content: 'second' },
      { role: 'user' as const, content: 'this-is-the-latest-message' },
    ]

    expect(
      trimChatMessagesForRequest(messages, {
        maxMessages: 10,
        maxCharacters: 10,
      }),
    ).toEqual([{ role: 'user', content: 'this-is-the-latest-message' }])
  })

  it('uses a small default recent-message window', () => {
    const messages = Array.from({ length: DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT + 2 })
      .map((_, index) => ({
        role: (index % 2 === 0 ? 'user' : 'assistant') as
          | 'user'
          | 'assistant',
        content: `message-${index + 1}`,
      }))

    const trimmed = trimChatMessagesForRequest(messages)

    expect(trimmed).toHaveLength(DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT)
    expect(trimmed[0]?.content).toBe('message-3')
    expect(trimmed.at(-1)?.content).toBe(
      `message-${DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT + 2}`,
    )
  })
})
