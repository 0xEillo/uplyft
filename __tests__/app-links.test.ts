jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>()

  return {
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key)
    }),
  }
})

import {
  APP_BASE_URL,
  buildAppUrl,
  buildInviteUrl,
  consumePendingInvite,
  createInviteShareLink,
  parseInvitePayload,
  savePendingInvite,
} from '@/lib/app-links'

describe('app links', () => {
  it('builds canonical app urls', () => {
    expect(buildAppUrl()).toBe(APP_BASE_URL)
    expect(buildAppUrl('invite/123')).toBe(`${APP_BASE_URL}/invite/123`)
    expect(buildInviteUrl('abc 123')).toBe(
      `${APP_BASE_URL}/invite/abc%20123`,
    )
  })

  it('creates invite links without calling a third-party service', async () => {
    await expect(
      createInviteShareLink({ inviterId: 'invite-user' }),
    ).resolves.toBe(`${APP_BASE_URL}/invite/invite-user`)
  })

  it('parses current and legacy invite params', () => {
    expect(
      parseInvitePayload({
        inviterId: '123',
        inviterTag: 'oliver',
      }),
    ).toEqual({
      inviterId: '123',
      inviterTag: 'oliver',
      inviterName: undefined,
    })

    expect(
      parseInvitePayload({
        referrer_id: ['456'],
        inviter_name: 'Rep AI',
      }),
    ).toEqual({
      inviterId: '456',
      inviterTag: undefined,
      inviterName: 'Rep AI',
    })
  })

  it('stores pending invites until consumed', async () => {
    await savePendingInvite('pending-user')

    await expect(consumePendingInvite()).resolves.toBe('pending-user')
    await expect(consumePendingInvite()).resolves.toBeNull()
  })
})
