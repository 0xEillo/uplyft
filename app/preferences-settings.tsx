import {
  SettingsCard,
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/ui/settings'
import { AnalyticsEvents } from '@/constants/analytics-events'
import {
  FontSize,
  FontWeight,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { Profile } from '@/types/database.types'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native'

export default function PreferencesSettingsScreen() {
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const { themePreference, setThemePreference } = useTheme()
  const colors = useThemedColors()
  const { weightUnit, setWeightUnit } = useWeightUnits()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPrivacyUpdating, setIsPrivacyUpdating] = useState(false)

  const loadProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const data = await database.profiles.getByIdOrNull(user.id)
      if (data) {
        setProfile(data)
      } else if (user.email) {
        const createdData = await database.profiles.getOrCreate(
          user.id,
          user.email,
        )
        setProfile(createdData)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.email, user?.id])

  const handleTogglePrivacy = useCallback(async () => {
    if (!user || !profile) return

    const nextValue = !profile.is_private
    trackEvent(AnalyticsEvents.SETTINGS_CHANGED, {
      setting: 'privacy',
      value: nextValue ? 'private' : 'public',
    })
    try {
      setIsPrivacyUpdating(true)
      const updated = await database.profiles.update(user.id, {
        is_private: nextValue,
      })
      setProfile(updated)
    } catch (error) {
      console.error('Error toggling privacy:', error)
      Alert.alert(
        'Error',
        'Unable to update privacy settings right now. Please try again.',
      )
    } finally {
      setIsPrivacyUpdating(false)
    }
  }, [user, profile, trackEvent])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const styles = createStyles(colors)

  const themeLabel =
    themePreference === 'system'
      ? 'System'
      : themePreference.charAt(0).toUpperCase() + themePreference.slice(1)

  return (
    <SettingsScreen title="Preferences" onBack={() => router.back()} loading={isLoading}>
      <SettingsSection title="App Preferences">
        <SettingsCard>
          <SettingsRow
            icon="barbell-outline"
            title="Weight Units"
            description="Choose your preferred unit system"
            rightContent={
              <TouchableOpacity
                style={styles.cycleButton}
                onPress={() => setWeightUnit(weightUnit === 'kg' ? 'lb' : 'kg')}
              >
                <Text style={styles.cycleButtonText}>
                  {weightUnit === 'kg' ? 'kg' : 'lbs'}
                </Text>
              </TouchableOpacity>
            }
          />
          <SettingsRow
            icon="person-outline"
            title="AI Coach"
            description={getCoach(profile?.coach).name}
            onPress={() => router.push('/coach-selection')}
            rightContent={
              <Text style={styles.inlineButtonText}>Change</Text>
            }
          />
          <SettingsRow
            icon="color-palette-outline"
            title="Theme"
            description="App appearance"
            rightContent={
              <TouchableOpacity
                style={styles.cycleButton}
                onPress={() => {
                  const themes = ['light', 'dark', 'system'] as const
                  const currentIndex = themes.indexOf(themePreference)
                  const nextTheme = themes[(currentIndex + 1) % themes.length]
                  setThemePreference(nextTheme)
                }}
              >
                <Text style={styles.cycleButtonText}>{themeLabel}</Text>
              </TouchableOpacity>
            }
          />
          <SettingsSwitchRow
            icon="lock-closed-outline"
            title="Private Profile"
            description="Only followers can see your workouts"
            value={profile?.is_private ?? false}
            onValueChange={handleTogglePrivacy}
            switchDisabled={!profile || isPrivacyUpdating}
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsScreen>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    cycleButton: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.xl,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: Layout.hairline,
      borderColor: colors.border,
      minWidth: 80,
      alignItems: 'center',
    },
    cycleButtonText: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.brandPrimary,
    },
    inlineButtonText: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textSecondary,
    },
  })
