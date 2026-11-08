import {
  DEFAULT_CHAT_HISTORY_DROP_CHUNK_SIZE,
  DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT,
  trimChatMessagesForRequest,
  type ChatHistoryMessage,
} from '@/lib/ai/chat-history'

function conversation(length: number): ChatHistoryMessage[] {
  return Array.from({ length }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `message-${index + 1}`,
  }))
}

describe('trimChatMessagesForRequest', () => {
  it('keeps everything while under the limits', () => {
    const messages = conversation(DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT)
    expect(trimChatMessagesForRequest(messages)).toEqual(messages)
  })

  it('drops old messages in whole blocks, starting on a user turn', () => {
    const messages = conversation(DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT + 2)
    const trimmed = trimChatMessagesForRequest(messages)

    expect(trimmed[0]).toEqual({
      role: 'user',
      content: `message-${DEFAULT_CHAT_HISTORY_DROP_CHUNK_SIZE + 1}`,
    })
    expect(trimmed.at(-1)?.content).toBe(
      `message-${DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT + 2}`,
    )
    expect(trimmed.length).toBeLessThanOrEqual(DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT)
  })

  it('keeps the window start stable across consecutive turns (cache-friendly)', () => {
    const limit = DEFAULT_CHAT_HISTORY_MESSAGE_LIMIT
    const chunk = DEFAULT_CHAT_HISTORY_DROP_CHUNK_SIZE
    const starts = new Set<string>()

    // Grow the chat one exchange at a time through a full block.
    for (let length = limit + 2; length < limit + chunk; length += 2) {
      starts.add(trimChatMessagesForRequest(conversation(length))[0].content)
    }

    expect(starts.size).toBe(1)
  })

  it('appends rather than rewrites between turns until the next block drop', () => {
    const before = trimChatMessagesForRequest(conversation(44))
    const after = trimChatMessagesForRequest(conversation(46))

    expect(after.slice(0, before.length)).toEqual(before)
  })

  it('drops blocks to fit the character budget but always keeps the latest message', () => {
    const messages: ChatHistoryMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'this-is-the-latest-message' },
    ]

    expect(
      trimChatMessagesForRequest(messages, {
        maxMessages: 10,
        maxCharacters: 10,
        dropChunkSize: 1,
      }),
    ).toEqual([{ role: 'user', content: 'this-is-the-latest-message' }])
  })

  it('does not start the window on an assistant message', () => {
    const messages: ChatHistoryMessage[] = [
      { role: 'assistant', content: 'welcome' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
    ]

    expect(
      trimChatMessagesForRequest(messages, { maxMessages: 2, dropChunkSize: 1 }),
    ).toEqual([
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
    ])
  })
})
