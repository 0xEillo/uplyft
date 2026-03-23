import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
  const insets = useSafeAreaInsets()
  const NAVBAR_HEIGHT = 76

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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerContent={<Text style={styles.headerTitle}>Preferences</Text>}
          />
        </BlurredHeader>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BlurredHeader>
        <BaseNavbar
          leftContent={
            <NavbarIsland>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={<Text style={styles.headerTitle}>Preferences</Text>}
        />
      </BlurredHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + NAVBAR_HEIGHT },
        ]}
        scrollIndicatorInsets={{ top: insets.top + NAVBAR_HEIGHT }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          <View style={styles.card}>
            {/* Unit Toggle */}
            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="barbell-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Weight Units</Text>
                  <Text style={styles.actionButtonSubtext}>Choose your preferred unit system</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.cycleButton}
                onPress={() => setWeightUnit(weightUnit === 'kg' ? 'lb' : 'kg')}
              >
                <Text style={styles.cycleButtonText}>
                  {weightUnit === 'kg' ? 'kg' : 'lbs'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cardDivider} />

            {/* Coach Selector */}
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/coach-selection')}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="person-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>AI Coach</Text>
                  <Text style={styles.actionButtonSubtext}>{getCoach(profile?.coach).name}</Text>
                </View>
              </View>
              <View style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>Change</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.cardDivider} />

            {/* Theme Selector */}
            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="color-palette-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Theme</Text>
                  <Text style={styles.actionButtonSubtext}>App appearance</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.cycleButton}
                onPress={() => {
                  const themes = ['light', 'dark', 'system'] as const
                  const currentIndex = themes.indexOf(themePreference)
                  const nextTheme = themes[(currentIndex + 1) % themes.length]
                  setThemePreference(nextTheme)
                }}
              >
                <Text style={styles.cycleButtonText}>
                  {themePreference === 'system'
                    ? 'System'
                    : themePreference.charAt(0).toUpperCase() +
                      themePreference.slice(1)}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cardDivider} />

            {/* Privacy Toggle */}
            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Private Profile</Text>
                  <Text style={styles.actionButtonSubtext}>Only followers can see your workouts</Text>
                </View>
              </View>
              <Switch
                value={profile?.is_private ?? false}
                onValueChange={handleTogglePrivacy}
                disabled={!profile || isPrivacyUpdating}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={profile?.is_private ? colors.brandPrimary : '#F3F4F6'}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 8,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    cardDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 50,
    },
    actionButton: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      flex: 1,
      marginRight: 16,
    },
    actionTextContainer: {
      flex: 1,
    },
    actionButtonTextNeutral: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    actionButtonSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    cycleButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 80,
      alignItems: 'center',
    },
    cycleButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    inlineButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inlineButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  })
