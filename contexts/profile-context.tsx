import { coerceBodyweightKg } from '@/lib/bodyweight'
import { database } from '@/lib/database'
import { applyPendingOnboardingProfile } from '@/lib/pending-onboarding'
import { Profile } from '@/types/database.types'
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react'
import { useAuth } from './auth-context'

interface ProfileContextType {
  profile: Profile | null
  isLoading: boolean
  coachId: string
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  refreshProfile: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

const DEFAULT_COACH_ID = 'ross'

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load profile when user changes
  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      await applyPendingOnboardingProfile(user.id).catch((error) => {
        console.warn(
          '[ProfileContext] Failed to apply pending onboarding profile:',
          error,
        )
      })
      const profileData = await database.profiles.getByIdOrNull(user.id)
      setProfile(profileData)
    } catch (error) {
      console.error('[ProfileContext] Error loading profile:', error)
      setProfile(null)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Load profile on mount and when user changes
  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Update profile with optimistic update
  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user?.id || !profile) {
        throw new Error('Cannot update profile: no user or profile loaded')
      }

      // Optimistic update. Coerce weight_kg so the optimistic state never
      // holds a non-numeric value (e.g. a numeric string from a form input).
      // Server-side, weight_kg is stripped by sanitizeProfileUpdates and the
      // canonical write goes through database.dailyLog.updateDay.
      const previousProfile = profile
      const optimisticUpdates: Partial<Profile> = { ...updates }
      if ('weight_kg' in optimisticUpdates) {
        optimisticUpdates.weight_kg = coerceBodyweightKg(
          optimisticUpdates.weight_kg,
        )
      }
      setProfile({ ...profile, ...optimisticUpdates })

      try {
        const updated = await database.profiles.update(user.id, updates)
        setProfile(updated)
      } catch (error) {
        // Revert on error
        console.error('[ProfileContext] Error updating profile:', error)
        setProfile(previousProfile)
        throw error
      }
    },
    [user?.id, profile],
  )

  // Force refresh profile from database
  const refreshProfile = useCallback(async () => {
    await loadProfile()
  }, [loadProfile])

  // Convenience getter for coach ID
  const coachId = profile?.coach || DEFAULT_COACH_ID

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        coachId,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}
