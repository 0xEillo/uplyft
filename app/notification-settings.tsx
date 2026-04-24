import {
  SettingsCard,
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
  Typography,
} from '@/constants/theme'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { registerForPushNotifications } from '@/hooks/usePushNotifications'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { RetentionPushPreferences } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

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

  const toggleDisabled = isPushSettingsUpdating || !retentionPrefs
  const childToggleDisabled = toggleDisabled || !notificationsEnabled

  return (
    <SettingsScreen
      title="Notification Settings"
      onBack={() => router.back()}
      loading={isLoading}
    >
      <SettingsSection title="Reminders & Nudges">
        <SettingsCard>
          <SettingsSwitchRow
            icon="notifications-outline"
            title="Workout Reminders"
            description="Off-app reminders to help you stay consistent"
            value={notificationsEnabled}
            onValueChange={(v) => handleToggleRetention('enabled', v)}
            switchDisabled={toggleDisabled}
          />
          <SettingsSwitchRow
            icon="time-outline"
            title="Scheduled Workout"
            description="Nudge near your preferred training hour"
            value={retentionPrefs?.scheduled_reminders_enabled ?? false}
            onValueChange={(v) =>
              handleToggleRetention('scheduled_reminders_enabled', v)
            }
            switchDisabled={childToggleDisabled}
          />
          <SettingsSwitchRow
            icon="flame-outline"
            title="Streak Protection"
            description="Evening reminder when your streak is in danger"
            value={retentionPrefs?.streak_protection_enabled ?? false}
            onValueChange={(v) =>
              handleToggleRetention('streak_protection_enabled', v)
            }
            switchDisabled={childToggleDisabled}
          />
          <SettingsSwitchRow
            icon="walk-outline"
            title="Inactivity Nudges"
            description="Comeback reminders after a few days away"
            value={retentionPrefs?.inactivity_enabled ?? false}
            onValueChange={(v) => handleToggleRetention('inactivity_enabled', v)}
            switchDisabled={childToggleDisabled}
          />
          <SettingsSwitchRow
            icon="calendar-outline"
            title="Weekly Recap"
            description="Monday recap to kick off your week"
            value={retentionPrefs?.weekly_recaps_enabled ?? false}
            onValueChange={(v) =>
              handleToggleRetention('weekly_recaps_enabled', v)
            }
            switchDisabled={childToggleDisabled}
          />
          <SettingsSwitchRow
            icon="trophy-outline"
            title="Milestones"
            description="Celebrate major training milestones"
            value={retentionPrefs?.milestones_enabled ?? false}
            onValueChange={(v) => handleToggleRetention('milestones_enabled', v)}
            switchDisabled={childToggleDisabled}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Global Snooze">
        <SettingsCard>
          <View style={styles.snoozeContainer}>
            <View style={styles.snoozeHeader}>
              <Ionicons
                name="moon-outline"
                size={22}
                color={colors.textSecondary}
              />
              <View style={styles.snoozeText}>
                <Text style={styles.snoozeTitle}>Pause Notifications</Text>
                <Text style={styles.snoozeSubtitle}>
                  Pause all reminder categories for a while.
                </Text>
              </View>
            </View>
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
        </SettingsCard>
      </SettingsSection>
    </SettingsScreen>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    snoozeContainer: {
      padding: Spacing.base,
    },
    snoozeHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.base,
    },
    snoozeText: {
      flex: 1,
    },
    snoozeTitle: {
      ...Typography.bodyLargeSemibold,
      color: colors.textPrimary,
    },
    snoozeSubtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: Spacing.xxs,
    },
    snoozedLabel: {
      ...Typography.caption,
      fontWeight: FontWeight.medium,
      color: colors.brandPrimary,
      marginTop: Spacing.md,
    },
    notificationPillGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    notificationPillButton: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.xl,
      borderWidth: Layout.hairline,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
    },
    notificationPillButtonText: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textSecondary,
    },
  })
