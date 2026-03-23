import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { registerForPushNotifications } from '@/hooks/usePushNotifications'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { RetentionPushPreferences } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
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

type RetentionToggleKey =
  | 'enabled'
  | 'scheduled_reminders_enabled'
  | 'streak_protection_enabled'
  | 'inactivity_enabled'
  | 'weekly_recaps_enabled'
  | 'milestones_enabled'

export default function NotificationSettingsScreen() {
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const colors = useThemedColors()
  const [retentionPrefs, setRetentionPrefs] =
    useState<RetentionPushPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPushSettingsUpdating, setIsPushSettingsUpdating] = useState(false)
  const insets = useSafeAreaInsets()
  const NAVBAR_HEIGHT = 76

  const loadRetentionPreferences = useCallback(async () => {
    if (!user?.id) return

    try {
      const prefs = await database.retentionPushPreferences.get(user.id)
      const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      if (localTimezone && prefs.timezone !== localTimezone) {
        const updated = await database.retentionPushPreferences.update(
          user.id,
          { timezone: localTimezone },
        )
        setRetentionPrefs(updated)
      } else {
        setRetentionPrefs(prefs)
      }
    } catch (error) {
      console.error('Error loading retention push preferences:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const handleToggleRetention = useCallback(
    async (key: RetentionToggleKey, value: boolean) => {
      if (!user?.id || !retentionPrefs) return

      trackEvent(AnalyticsEvents.SETTINGS_CHANGED, {
        setting: `push_${key}`,
        value: value ? 'on' : 'off',
      })

      try {
        setIsPushSettingsUpdating(true)

        if (value) {
          await registerForPushNotifications()
          await database.profiles.update(user.id, {
            has_requested_push_notifications: true,
          })
        }

        const updated = await database.retentionPushPreferences.update(
          user.id,
          { [key]: value },
        )
        setRetentionPrefs(updated)
      } catch (error) {
        console.error('Error updating retention push setting:', error)
        Alert.alert(
          'Error',
          'Unable to update notification settings right now. Please try again.',
        )
      } finally {
        setIsPushSettingsUpdating(false)
      }
    },
    [retentionPrefs, trackEvent, user?.id],
  )

  const handleSnoozeNotifications = useCallback(
    async (days: 1 | 3 | 7) => {
      if (!user?.id || !retentionPrefs) return

      trackEvent(AnalyticsEvents.SETTINGS_CHANGED, {
        setting: 'push_snooze',
        value: `${days}_days`,
      })

      try {
        setIsPushSettingsUpdating(true)
        const updated = await database.retentionPushPreferences.snooze(
          user.id,
          days,
        )
        setRetentionPrefs(updated)
      } catch (error) {
        console.error('Error snoozing notifications:', error)
      } finally {
        setIsPushSettingsUpdating(false)
      }
    },
    [retentionPrefs, trackEvent, user?.id],
  )

  const handleClearSnooze = useCallback(async () => {
    if (!user?.id || !retentionPrefs) return

    try {
      setIsPushSettingsUpdating(true)
      const updated = await database.retentionPushPreferences.clearSnooze(
        user.id,
      )
      setRetentionPrefs(updated)
    } catch (error) {
      console.error('Error clearing notification snooze:', error)
    } finally {
      setIsPushSettingsUpdating(false)
    }
  }, [retentionPrefs, user?.id])

  useEffect(() => {
    loadRetentionPreferences()
  }, [loadRetentionPreferences])

  useFocusEffect(
    useCallback(() => {
      loadRetentionPreferences()
    }, [loadRetentionPreferences]),
  )

  const styles = createStyles(colors)
  const snoozedUntilLabel = retentionPrefs?.snoozed_until
    ? new Date(retentionPrefs.snoozed_until).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null
  const notificationsEnabled = retentionPrefs?.enabled ?? false

  if (isLoading) {
    return (
      <View style={styles.container}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backButton}
                >
                  <Ionicons
                    name="arrow-back"
                    size={24}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerContent={
              <Text style={styles.headerTitle}>Notification Settings</Text>
            }
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
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={
            <Text style={styles.headerTitle}>Notification Settings</Text>
          }
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
          <Text style={styles.sectionTitle}>Reminders & Nudges</Text>
          <View style={styles.card}>
            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Workout Reminders</Text>
                  <Text style={styles.actionButtonSubtext}>Off-app reminders to help you stay consistent</Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={(value) => handleToggleRetention('enabled', value)}
                disabled={isPushSettingsUpdating || !retentionPrefs}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={notificationsEnabled ? colors.brandPrimary : '#F3F4F6'}
              />
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Scheduled Workout</Text>
                  <Text style={styles.actionButtonSubtext}>Nudge near your preferred training hour</Text>
                </View>
              </View>
              <Switch
                value={retentionPrefs?.scheduled_reminders_enabled ?? false}
                onValueChange={(value) => handleToggleRetention('scheduled_reminders_enabled', value)}
                disabled={isPushSettingsUpdating || !retentionPrefs || !notificationsEnabled}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={retentionPrefs?.scheduled_reminders_enabled ? colors.brandPrimary : '#F3F4F6'}
              />
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="flame-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Streak Protection</Text>
                  <Text style={styles.actionButtonSubtext}>Evening reminder when your streak is in danger</Text>
                </View>
              </View>
              <Switch
                value={retentionPrefs?.streak_protection_enabled ?? false}
                onValueChange={(value) => handleToggleRetention('streak_protection_enabled', value)}
                disabled={isPushSettingsUpdating || !retentionPrefs || !notificationsEnabled}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={retentionPrefs?.streak_protection_enabled ? colors.brandPrimary : '#F3F4F6'}
              />
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="walk-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Inactivity Nudges</Text>
                  <Text style={styles.actionButtonSubtext}>Comeback reminders after a few days away</Text>
                </View>
              </View>
              <Switch
                value={retentionPrefs?.inactivity_enabled ?? false}
                onValueChange={(value) => handleToggleRetention('inactivity_enabled', value)}
                disabled={isPushSettingsUpdating || !retentionPrefs || !notificationsEnabled}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={retentionPrefs?.inactivity_enabled ? colors.brandPrimary : '#F3F4F6'}
              />
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Weekly Recap</Text>
                  <Text style={styles.actionButtonSubtext}>Monday recap to kick off your week</Text>
                </View>
              </View>
              <Switch
                value={retentionPrefs?.weekly_recaps_enabled ?? false}
                onValueChange={(value) => handleToggleRetention('weekly_recaps_enabled', value)}
                disabled={isPushSettingsUpdating || !retentionPrefs || !notificationsEnabled}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={retentionPrefs?.weekly_recaps_enabled ? colors.brandPrimary : '#F3F4F6'}
              />
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="trophy-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Milestones</Text>
                  <Text style={styles.actionButtonSubtext}>Celebrate major training milestones</Text>
                </View>
              </View>
              <Switch
                value={retentionPrefs?.milestones_enabled ?? false}
                onValueChange={(value) => handleToggleRetention('milestones_enabled', value)}
                disabled={isPushSettingsUpdating || !retentionPrefs || !notificationsEnabled}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={retentionPrefs?.milestones_enabled ? colors.brandPrimary : '#F3F4F6'}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Global Snooze</Text>
          <View style={styles.card}>
            <View style={styles.snoozeContainer}>
              <Text style={styles.actionButtonTextNeutral}>Pause Notifications</Text>
              <Text style={styles.actionButtonSubtext}>
                Pause all reminder categories for a while.
              </Text>
              <View style={styles.notificationPillGroup}>
                {[1, 3, 7].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={styles.notificationPillButton}
                    onPress={() => handleSnoozeNotifications(days as 1 | 3 | 7)}
                    disabled={isPushSettingsUpdating || !retentionPrefs}
                  >
                    <Text style={styles.notificationPillButtonText}>{days}d</Text>
                  </TouchableOpacity>
                ))}
                {retentionPrefs?.snoozed_until && (
                  <TouchableOpacity
                    style={styles.notificationPillButton}
                    onPress={handleClearSnooze}
                    disabled={isPushSettingsUpdating}
                  >
                    <Text style={styles.notificationPillButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              {snoozedUntilLabel && (
                <Text style={styles.snoozedLabel}>
                  Snoozed until {snoozedUntilLabel}
                </Text>
              )}
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
    snoozeContainer: {
      padding: 16,
    },
    snoozedLabel: {
      fontSize: 13,
      color: colors.brandPrimary,
      marginTop: 12,
      fontWeight: '500',
    },
    notificationPillGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    notificationPillButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
    },
    notificationPillButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  })
