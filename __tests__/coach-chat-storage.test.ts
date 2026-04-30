import { MMKV } from 'react-native-mmkv'

import {
  clearAllCoachChatSnapshots,
  getCoachChatPersistenceScopeKey,
  loadCoachChatSnapshot,
  mergeExternalMessages,
  migrateCoachChatSnapshot,
  saveCoachChatSnapshot,
  sanitizeCoachChatSnapshot,
} from '../lib/utils/coach-chat-storage'

const mmkvMock = MMKV as typeof MMKV & {
  __clearAll: () => void
  __getStore: (id?: string) => Record<string, string>
}

const STORAGE_ID = 'coach-chat'
const USER_ID = 'user-1'
const STORAGE_KEY = '@coach_chat_snapshots_v1:user-1'

beforeEach(() => {
  mmkvMock.__clearAll()
})

describe('coach chat storage', () => {
  test('saves and restores the main chat snapshot', async () => {
    await saveCoachChatSnapshot(USER_ID, { kind: 'main' }, {
      messages: [
        { id: '1', role: 'assistant', content: 'Welcome back' },
      ],
      input: 'Need a pull day',
      selectedImages: ['file:///meal.jpg'],
    })

    const snapshot = await loadCoachChatSnapshot(USER_ID, { kind: 'main' })

    expect(snapshot).toEqual({
      messages: [{ id: '1', role: 'assistant', content: 'Welcome back' }],
      input: 'Need a pull day',
      selectedImages: ['file:///meal.jpg'],
    })
  })

  test('stores create-post chats per composer session id', async () => {
    await saveCoachChatSnapshot(USER_ID, { kind: 'create_post', sessionId: 'session-a' }, {
      messages: [{ id: 'a', role: 'user', content: 'Build legs' }],
      input: '',
      selectedImages: [],
    })
    await saveCoachChatSnapshot(USER_ID, { kind: 'create_post', sessionId: 'session-b' }, {
      messages: [{ id: 'b', role: 'assistant', content: 'Here is a push day.' }],
      input: '',
      selectedImages: [],
    })

    expect(
      await loadCoachChatSnapshot(USER_ID, {
        kind: 'create_post',
        sessionId: 'session-a',
      }),
    ).toEqual({
      messages: [{ id: 'a', role: 'user', content: 'Build legs' }],
      input: '',
      selectedImages: [],
    })
    expect(
      await loadCoachChatSnapshot(USER_ID, {
        kind: 'create_post',
        sessionId: 'session-b',
      }),
    ).toEqual({
      messages: [{ id: 'b', role: 'assistant', content: 'Here is a push day.' }],
      input: '',
      selectedImages: [],
    })
  })

  test('clears all scopes for a user', async () => {
    await saveCoachChatSnapshot(USER_ID, { kind: 'main' }, {
      messages: [{ id: '1', role: 'user', content: 'Hi' }],
      input: '',
      selectedImages: [],
    })
    await saveCoachChatSnapshot(USER_ID, { kind: 'create_post', sessionId: 'session-a' }, {
      messages: [{ id: '2', role: 'assistant', content: 'Hello' }],
      input: '',
      selectedImages: [],
    })

    await clearAllCoachChatSnapshots(USER_ID)

    expect(await loadCoachChatSnapshot(USER_ID, { kind: 'main' })).toBeNull()
    expect(
      await loadCoachChatSnapshot(USER_ID, {
        kind: 'create_post',
        sessionId: 'session-a',
      }),
    ).toBeNull()
    expect(mmkvMock.__getStore(STORAGE_ID)[STORAGE_KEY]).toBeUndefined()
  })

  test('ignores old-version collections safely', async () => {
    mmkvMock.__getStore(STORAGE_ID)[STORAGE_KEY] = JSON.stringify({
      version: 99,
      snapshots: {
        main: {
          messages: [{ id: '1', role: 'assistant', content: 'old' }],
          input: '',
          selectedImages: [],
          savedAt: 1,
        },
      },
    })

    expect(await loadCoachChatSnapshot(USER_ID, { kind: 'main' })).toBeNull()
  })

  test('sanitizes incomplete messages on restore', () => {
    const snapshot = sanitizeCoachChatSnapshot({
      messages: [
        { id: '1', role: 'assistant', content: '' },
        { id: '2', role: 'user', content: 'Still there?', status: 'sending' },
        { id: '3', role: 'assistant', content: 'Partial answer...' },
      ],
      input: '',
      selectedImages: [],
    })

    expect(snapshot).toEqual({
      messages: [
        { id: '2', role: 'user', content: 'Still there?', status: 'failed' },
        { id: '3', role: 'assistant', content: 'Partial answer...' },
      ],
      input: '',
      selectedImages: [],
    })
  })

  test('migrates the create-post draft scope into a real session scope', async () => {
    await saveCoachChatSnapshot(USER_ID, { kind: 'create_post' }, {
      messages: [{ id: '1', role: 'assistant', content: 'Draft chat' }],
      input: '',
      selectedImages: [],
    })

    await migrateCoachChatSnapshot(
      USER_ID,
      { kind: 'create_post' },
      { kind: 'create_post', sessionId: 'session-123' },
    )

    expect(
      await loadCoachChatSnapshot(USER_ID, {
        kind: 'create_post',
        sessionId: 'session-123',
      }),
    ).toEqual({
      messages: [{ id: '1', role: 'assistant', content: 'Draft chat' }],
      input: '',
      selectedImages: [],
    })
    expect(
      getCoachChatPersistenceScopeKey({ kind: 'create_post' }),
    ).toBe('create_post:draft')
    expect(
      await loadCoachChatSnapshot(USER_ID, { kind: 'create_post' }),
    ).toBeNull()
  })

  test('merges external messages chronologically and de-dupes by id', () => {
    const merged = mergeExternalMessages(
      [
        {
          id: 'existing',
          role: 'assistant',
          content: 'Already here',
          createdAt: '2026-04-30T10:00:00.000Z',
        },
        {
          id: 'proactive_a',
          role: 'assistant',
          content: 'Same proactive message',
          createdAt: '2026-04-30T10:05:00.000Z',
        },
      ],
      [
        {
          id: 'proactive_b',
          role: 'assistant',
          content: 'Earlier proactive message',
          createdAt: '2026-04-30T09:55:00.000Z',
        },
        {
          id: 'proactive_a',
          role: 'assistant',
          content: 'Duplicate proactive message',
          createdAt: '2026-04-30T10:05:00.000Z',
        },
      ],
    )

    expect(merged.map((message) => message.id)).toEqual([
      'proactive_b',
      'existing',
      'proactive_a',
    ])
    expect(merged.find((message) => message.id === 'proactive_a')?.content).toBe(
      'Same proactive message',
    )
  })
})
