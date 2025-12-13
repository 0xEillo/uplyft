import { database } from '@/lib/database'
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
      const data = await database.profiles.getByIdOrNull(user.id)
      setProfile(data)
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

      // Optimistic update
      const previousProfile = profile
      setProfile({ ...profile, ...updates })

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
