/* eslint-disable import/first */

jest.mock('../lib/database', () => ({
  database: {
    profiles: {
      getByIdOrNull: jest.fn(),
      generateUniqueUserTag: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}))

import {
  captureLinkedProfileSnapshot,
  syncLinkedProfile,
} from '../lib/account-linking'
import { database } from '../lib/database'
import { supabase } from '../lib/supabase'

const mockGetByIdOrNull = jest.mocked(database.profiles.getByIdOrNull)
const mockGenerateUniqueUserTag = jest.mocked(
  database.profiles.generateUniqueUserTag,
)
const mockUpsert = jest.mocked(database.profiles.upsert)
const mockGetUser = jest.mocked(supabase.auth.getUser)

describe('account linking profile sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses the pre-link profile snapshot when provider linking resets identity fields', async () => {
    const profileBeforeLink = {
      id: 'user-1',
      display_name: 'Oliver Ryall',
      user_tag: 'oliverr',
      gender: 'male',
      height_cm: 183,
      age: 31,
      goals: ['gain_strength'],
      commitment: ['monday'],
      commitment_frequency: null,
      experience_level: 'intermediate',
      bio: 'Still lifting.',
      coach: 'ross',
    }

    mockGetByIdOrNull.mockResolvedValueOnce(profileBeforeLink as any)

    const snapshot = await captureLinkedProfileSnapshot('user-1')

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
    } as any)
    mockGetByIdOrNull.mockResolvedValueOnce({
      id: 'user-1',
      display_name: 'google.email',
      user_tag: 'googleemail',
      gender: null,
      height_cm: null,
      age: null,
      goals: null,
      commitment: null,
      commitment_frequency: null,
      experience_level: null,
      bio: null,
      coach: null,
    } as any)
    mockUpsert.mockResolvedValue({ id: 'user-1' } as any)

    await syncLinkedProfile('user-1', snapshot)

    expect(mockGenerateUniqueUserTag).not.toHaveBeenCalled()
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        display_name: 'Oliver Ryall',
        user_tag: 'oliverr',
        gender: 'male',
        height_cm: 183,
        age: 31,
        goals: ['gain_strength'],
        commitment: ['monday'],
        experience_level: 'intermediate',
        bio: 'Still lifting.',
        coach: 'ross',
        is_guest: false,
      }),
    )
  })
})
