import AsyncStorage from '@react-native-async-storage/async-storage'
import { database } from '@/lib/database'
import {
  persistOnboardingStrengthSnapshot,
  type OnboardingStrengthSnapshotInput,
} from '@/lib/onboarding-strength'
import { persistOnboardingWeight } from '@/lib/onboarding-weight'
import {
  resolveOnboardingDisplayName,
  resolveUserTagBase,
} from '@/lib/profile-identity'
import type {
  CommitmentDay,
  CommitmentFrequency,
  CommitmentMode,
  ExperienceLevel,
  Gender,
  Goal,
} from '@/types/database.types'

const PENDING_ONBOARDING_STORAGE_KEY = '@pending_onboarding_profile_v1'

export type PendingOnboardingProfileData = {
  name: string
  gender: Gender | null
  height_cm: number | null
  weight_kg: number | null
  age: number | null
  goal: Goal[]
  commitment?: CommitmentDay[] | null
  commitment_frequency?: CommitmentFrequency | null
  commitment_mode: CommitmentMode
  experience_level?: ExperienceLevel | null
  bio: string | null
  coach?: string | null
  strength_snapshot?: OnboardingStrengthSnapshotInput | null
}

type StoredPendingOnboardingProfile = {
  userId: string
  onboardingData: PendingOnboardingProfileData
}

const readPendingOnboardingProfile = async (): Promise<StoredPendingOnboardingProfile | null> => {
  const raw = await AsyncStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StoredPendingOnboardingProfile
  } catch (error) {
    console.warn('[PendingOnboarding] Failed to parse pending onboarding payload.', error)
    await AsyncStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY)
    return null
  }
}

export async function queuePendingOnboardingProfile(
  userId: string,
  onboardingData: PendingOnboardingProfileData,
): Promise<void> {
  await AsyncStorage.setItem(
    PENDING_ONBOARDING_STORAGE_KEY,
    JSON.stringify({
      userId,
      onboardingData,
    } satisfies StoredPendingOnboardingProfile),
  )
}

export async function clearPendingOnboardingProfile(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY)
}

export async function syncOnboardingDataToProfile(
  userId: string,
  onboardingData: PendingOnboardingProfileData,
): Promise<void> {
  const displayName = resolveOnboardingDisplayName(onboardingData.name)
  const userTagBase = resolveUserTagBase(displayName)
  const existingProfile = await database.profiles
    .getByIdOrNull(userId)
    .catch((error) => {
      console.warn(
        '[PendingOnboarding] Failed to load existing profile before onboarding sync.',
        error,
      )
      return null
    })

  let userTag: string | null = existingProfile?.user_tag ?? null
  if (!userTag) {
    try {
      userTag = await database.profiles.generateUniqueUserTag(userTagBase)
    } catch (tagError) {
      console.warn(
        '[PendingOnboarding] Failed to generate user tag from onboarding name. Falling back to Athlete.',
        tagError,
      )
      userTag = await database.profiles.generateUniqueUserTag('Athlete')
    }
  }

  await database.profiles.upsert({
    id: userId,
    user_tag: userTag,
    display_name: displayName,
    gender: onboardingData.gender,
    height_cm: onboardingData.height_cm,
    age: onboardingData.age,
    goals: onboardingData.goal.length > 0 ? onboardingData.goal : null,
    commitment:
      onboardingData.commitment_mode === 'specific_days'
        ? onboardingData.commitment ?? null
        : null,
    commitment_frequency:
      onboardingData.commitment_mode === 'frequency'
        ? onboardingData.commitment_frequency ?? null
        : null,
    experience_level: onboardingData.experience_level ?? null,
    bio: onboardingData.bio,
    coach: onboardingData.coach,
  })

  await persistOnboardingWeight(userId, onboardingData.weight_kg)
  await persistOnboardingStrengthSnapshot(
    userId,
    onboardingData.strength_snapshot,
  )
}

export async function applyPendingOnboardingProfile(
  userId: string,
): Promise<boolean> {
  const pendingProfile = await readPendingOnboardingProfile()

  if (!pendingProfile || pendingProfile.userId !== userId) {
    return false
  }

  await syncOnboardingDataToProfile(userId, pendingProfile.onboardingData)
  await clearPendingOnboardingProfile()

  return true
}
