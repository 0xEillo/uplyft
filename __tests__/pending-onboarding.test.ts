/* eslint-disable import/first */

const storage = new Map<string, string>()

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => storage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      storage.set(key, value)
    }),
    removeItem: jest.fn(async (key: string) => {
      storage.delete(key)
    }),
  },
}))

jest.mock('../lib/database', () => ({
  database: {
    profiles: {
      getByIdOrNull: jest.fn(),
      generateUniqueUserTag: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

jest.mock('../lib/onboarding-weight', () => ({
  persistOnboardingWeight: jest.fn(),
}))

jest.mock('../lib/onboarding-strength', () => ({
  persistOnboardingStrengthSnapshot: jest.fn(),
}))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { database } from '../lib/database'
import {
  applyPendingOnboardingProfile,
  queuePendingOnboardingProfile,
} from '../lib/pending-onboarding'
import { persistOnboardingStrengthSnapshot } from '../lib/onboarding-strength'
import { persistOnboardingWeight } from '../lib/onboarding-weight'

const mockAsyncStorage = jest.mocked(AsyncStorage)
const mockGetByIdOrNull = jest.mocked(database.profiles.getByIdOrNull)
const mockGenerateUniqueUserTag = jest.mocked(
  database.profiles.generateUniqueUserTag,
)
const mockUpsert = jest.mocked(database.profiles.upsert)
const mockPersistOnboardingWeight = jest.mocked(persistOnboardingWeight)
const mockPersistOnboardingStrengthSnapshot = jest.mocked(
  persistOnboardingStrengthSnapshot,
)

describe('pending onboarding profile sync', () => {
  beforeEach(() => {
    storage.clear()
    jest.clearAllMocks()
  })

  it('queues and applies pending onboarding data for the matching user', async () => {
    mockGetByIdOrNull.mockResolvedValue(null)
    mockGenerateUniqueUserTag.mockResolvedValue('janedoe')
    mockUpsert.mockResolvedValue({ id: 'user-1' } as any)
    mockPersistOnboardingWeight.mockResolvedValue(undefined)
    mockPersistOnboardingStrengthSnapshot.mockResolvedValue(undefined)

    await queuePendingOnboardingProfile('user-1', {
      name: 'Jane Doe',
      gender: 'female',
      height_cm: 168,
      weight_kg: 82.5,
      age: 31,
      goal: ['lose_fat'],
      commitment: ['monday', 'wednesday'],
      commitment_frequency: null,
      commitment_mode: 'specific_days',
      experience_level: 'intermediate',
      bio: 'Cutting phase',
      coach: 'ross',
      strength_snapshot: {
        exerciseName: 'Bench Press',
        workingWeightKg: 60,
        reps: 8,
        estimated1RMKg: 76,
      },
    })

    await expect(applyPendingOnboardingProfile('user-1')).resolves.toBe(true)

    expect(mockAsyncStorage.setItem).toHaveBeenCalled()
    expect(mockGenerateUniqueUserTag).toHaveBeenCalledWith('Jane Doe')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        user_tag: 'janedoe',
        display_name: 'Jane Doe',
        gender: 'female',
        height_cm: 168,
        age: 31,
        goals: ['lose_fat'],
        commitment: ['monday', 'wednesday'],
        commitment_frequency: null,
        experience_level: 'intermediate',
        bio: 'Cutting phase',
        coach: 'ross',
      }),
    )
    expect(mockPersistOnboardingWeight).toHaveBeenCalledWith('user-1', 82.5)
    expect(mockPersistOnboardingStrengthSnapshot).toHaveBeenCalledWith(
      'user-1',
      {
        exerciseName: 'Bench Press',
        workingWeightKg: 60,
        reps: 8,
        estimated1RMKg: 76,
      },
    )
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
      '@pending_onboarding_profile_v1',
    )
  })

  it('does not apply pending onboarding data to a different user', async () => {
    await queuePendingOnboardingProfile('user-1', {
      name: 'Jane Doe',
      gender: 'female',
      height_cm: 168,
      weight_kg: 82.5,
      age: 31,
      goal: ['lose_fat'],
      commitment: null,
      commitment_frequency: '3_times',
      commitment_mode: 'frequency',
      bio: null,
    })

    await expect(applyPendingOnboardingProfile('user-2')).resolves.toBe(false)

    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockPersistOnboardingWeight).not.toHaveBeenCalled()
    expect(mockPersistOnboardingStrengthSnapshot).not.toHaveBeenCalled()
    expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled()
  })
})
