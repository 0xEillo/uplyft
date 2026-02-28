import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useTheme } from '@/contexts/theme-context'
import { registerForPushNotifications } from '@/hooks/usePushNotifications'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Profile, RetentionPushPreferences } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
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

export default function SettingsScreen() {
  const { user, signOut, isAnonymous } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>()
  const { themePreference, setThemePreference } = useTheme()
  const colors = useThemedColors()
  const { weightUnit, setWeightUnit } = useWeightUnits()
  const { isProMember, customerInfo, restorePurchases } = useSubscription()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRestoring, setIsRestoring] = useState(false)
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [isPrivacyUpdating, setIsPrivacyUpdating] = useState(false)
  const [retentionPrefs, setRetentionPrefs] =
    useState<RetentionPushPreferences | null>(null)
  const [isPushSettingsUpdating, setIsPushSettingsUpdating] = useState(false)
  const [isSendingTestNotification, setIsSendingTestNotification] =
    useState(false)
  const insets = useSafeAreaInsets()
  const NAVBAR_HEIGHT = 76
  const resolvedReturnTo =
    Array.isArray(returnTo) && returnTo.length > 0 ? returnTo[0] : returnTo

  const loadProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      // Try to get existing profile - signInAnonymously should have created one for anonymous users
      const data = await database.profiles.getByIdOrNull(user.id)

      if (!data) {
        // Profile doesn't exist - try to create one (fallback)
        if (user.email) {
          const createdData = await database.profiles.getOrCreate(
            user.id,
            user.email,
          )
          setProfile(createdData)
        } else {
          console.error('Profile not found for anonymous user:', user.id)
        }
      } else {
        setProfile(data)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.email, user?.id])

  const loadPendingRequests = useCallback(async () => {
    if (!user) return

    try {
      const count = await database.followRequests.countIncomingPending(user.id)
      setPendingRequestCount(count)
    } catch (error) {
      console.error('Error loading follow requests count:', error)
    }
  }, [user])

  const loadRetentionPreferences = useCallback(async () => {
    if (!user?.id) return

    try {
      const prefs = await database.retentionPushPreferences.get(user.id)
      const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      if (localTimezone && prefs.timezone !== localTimezone) {
        const updated = await database.retentionPushPreferences.update(user.id, {
          timezone: localTimezone,
        })
        setRetentionPrefs(updated)
      } else {
        setRetentionPrefs(prefs)
      }
    } catch (error) {
      console.error('Error loading retention push preferences:', error)
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

        const updated = await database.retentionPushPreferences.update(user.id, {
          [key]: value,
        })
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

  const handleUpdateReminderHour = useCallback(
    async (hour: number) => {
      if (!user?.id || !retentionPrefs) return

      try {
        setIsPushSettingsUpdating(true)
        const updated = await database.retentionPushPreferences.update(user.id, {
          preferred_reminder_hour: hour,
        })
        setRetentionPrefs(updated)
      } catch (error) {
        console.error('Error updating reminder hour:', error)
      } finally {
        setIsPushSettingsUpdating(false)
      }
    },
    [retentionPrefs, user?.id],
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

  const handleTestNotification = useCallback(async () => {
    try {
      setIsSendingTestNotification(true)

      await registerForPushNotifications()

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test reminder 💪',
          body: 'This is how your workout reminder will appear.',
          data: {
            type: 'retention_scheduled_workout',
            route: '/(tabs)/create-post',
          },
        },
        trigger: null,
      })
    } catch (error) {
      console.error('Error scheduling test notification:', error)
      Alert.alert('Error', 'Unable to send a test notification right now.')
    } finally {
      setIsSendingTestNotification(false)
    }
  }, [])

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

  const handleOpenFollowRequests = useCallback(() => {
    router.push('/follow-requests')
  }, [router])

  const handleGoBack = useCallback(() => {
    if (resolvedReturnTo && typeof resolvedReturnTo === 'string') {
      router.replace(resolvedReturnTo as any)
      return
    }
    router.back()
  }, [resolvedReturnTo, router])

  useEffect(() => {
    loadProfile()
    loadPendingRequests()
    loadRetentionPreferences()
  }, [loadProfile, loadPendingRequests, loadRetentionPreferences])

  useFocusEffect(
    useCallback(() => {
      loadPendingRequests()
      loadRetentionPreferences()
    }, [loadPendingRequests, loadRetentionPreferences]),
  )

  const styles = createStyles(colors)

  const handleSignOut = async () => {
    // Different warning for guest users
    if (isAnonymous) {
      Alert.alert(
        'Warning: Data Will Be Lost',
        'As a guest, signing out will permanently delete all your workouts and progress. Create an account first to save your data.',
        [
          {
            text: 'Create Account',
            onPress: () => router.push('/(auth)/create-account'),
          },
          {
            text: 'Sign Out Anyway',
            style: 'destructive',
            onPress: async () => {
              try {
                trackEvent(AnalyticsEvents.USER_SIGNED_OUT, {
                  is_anonymous: true,
                })
                await signOut()
                router.replace('/(auth)/welcome')
              } catch (error) {
                Alert.alert(
                  'Error',
                  error instanceof Error ? error.message : 'Failed to sign out',
                )
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      )
      return
    }

    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            trackEvent(AnalyticsEvents.USER_SIGNED_OUT, {
              is_anonymous: false,
            })
            await signOut()
            router.replace('/(auth)/welcome')
          } catch (error) {
            Alert.alert(
              'Error',
              error instanceof Error ? error.message : 'Failed to sign out',
            )
          }
        },
      },
    ])
  }

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data, workouts, and progress will be permanently deleted. Are you absolutely sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              trackEvent(AnalyticsEvents.ACCOUNT_DELETED)
              // Delete user account via Supabase admin API
              const { error } = await supabase.rpc('delete_user')

              if (error) throw error

              await signOut()
              router.replace('/(auth)/welcome')
              Alert.alert(
                'Account Deleted',
                'Your account has been permanently deleted.',
              )
            } catch (error) {
              console.error('Error deleting account:', error)
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Failed to delete account. Please try again.',
              )
            }
          },
        },
      ],
    )
  }

  const handleContactSupport = async () => {
    const supportEmail = 'support@repaifit.app'
    const subject = 'Support Request'
    const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(
      subject,
    )}`

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl)
      if (canOpen) {
        await Linking.openURL(mailtoUrl)
      } else {
        Alert.alert(
          'Email Not Available',
          `Please send an email to ${supportEmail}`,
          [{ text: 'OK' }],
        )
      }
    } catch (error) {
      console.error('Error opening email:', error)
      Alert.alert(
        'Email Not Available',
        `Please send an email to ${supportEmail}`,
        [{ text: 'OK' }],
      )
    }
  }

  const handleRestorePurchases = async () => {
    try {
      setIsRestoring(true)
      const restoredCustomerInfo = await restorePurchases()

      // Check if Pro entitlement was restored
      const hasProEntitlement = Boolean(
        restoredCustomerInfo?.entitlements.active['Pro'],
      )

      if (hasProEntitlement) {
        Alert.alert('Success', 'Your purchases have been restored.', [
          { text: 'OK' },
        ])
      } else {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found for this account.',
          [{ text: 'OK' }],
        )
      }
    } catch {
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again.',
        [{ text: 'OK' }],
      )
    } finally {
      setIsRestoring(false)
    }
  }

  const handleManageSubscription = async () => {
    // Platform-specific subscription management
    const subscriptionUrl =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions'

    try {
      const canOpen = await Linking.canOpenURL(subscriptionUrl)
      if (canOpen) {
        await Linking.openURL(subscriptionUrl)
      } else {
        Alert.alert(
          'Unable to Open',
          Platform.OS === 'ios'
            ? 'Please open Settings > [Your Name] > Subscriptions to manage your subscription.'
            : 'Open Google Play > Profile > Payments & subscriptions to manage your subscription.',
          [{ text: 'OK' }],
        )
      }
    } catch (error) {
      console.error('Error opening subscription management:', error)
      Alert.alert(
        'Unable to Open',
        Platform.OS === 'ios'
          ? 'Please open Settings > [Your Name] > Subscriptions to manage your subscription.'
          : 'Open Google Play > Profile > Payments & subscriptions to manage your subscription.',
        [{ text: 'OK' }],
      )
    }
  }

  const handleOpenPrivacyPolicy = async () => {
    const privacyUrl = 'https://www.repaifit.app/legal/privacy'
    try {
      const canOpen = await Linking.canOpenURL(privacyUrl)
      if (canOpen) {
        await Linking.openURL(privacyUrl)
      } else {
        Alert.alert(
          'Unable to Open',
          'Could not open privacy policy. Please visit repaifit.app/legal/privacy',
          [{ text: 'OK' }],
        )
      }
    } catch (error) {
      console.error('Error opening privacy policy:', error)
      Alert.alert(
        'Unable to Open',
        'Could not open privacy policy. Please visit repaifit.app/legal/privacy',
        [{ text: 'OK' }],
      )
    }
  }

  const handleOpenTermsOfUse = async () => {
    const termsUrl = 'https://www.repaifit.app/terms'
    try {
      const canOpen = await Linking.canOpenURL(termsUrl)
      if (canOpen) {
        await Linking.openURL(termsUrl)
      } else {
        Alert.alert(
          'Unable to Open',
          'Could not open terms of use. Please visit repaifit.app/terms',
          [{ text: 'OK' }],
        )
      }
    } catch (error) {
      console.error('Error opening terms of use:', error)
      Alert.alert(
        'Unable to Open',
        'Could not open terms of use. Please visit repaifit.app/terms',
        [{ text: 'OK' }],
      )
    }
  }

  // Get subscription status display
  const getSubscriptionStatus = () => {
    if (!customerInfo) return 'loading'

    const proEntitlement = customerInfo.entitlements.active['Pro']
    if (!proEntitlement) {
      return 'free'
    }

    if (proEntitlement.periodType === 'trial') {
      return 'trial'
    }

    return 'active'
  }

  const getNextBillingDate = () => {
    if (!customerInfo) return null

    const proEntitlement = customerInfo.entitlements.active['Pro']
    if (proEntitlement && proEntitlement.expirationDate) {
      const date = new Date(proEntitlement.expirationDate)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }

    return null
  }

  const reminderHourOptions = [6, 9, 12, 17, 19]
  const formatHourLabel = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}${period}`
  }

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
                  onPress={handleGoBack}
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerContent={<Text style={styles.headerTitle}>Settings</Text>}
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
              <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={<Text style={styles.headerTitle}>Settings</Text>}
        />
      </BlurredHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + NAVBAR_HEIGHT }]}
        scrollIndicatorInsets={{ top: insets.top + NAVBAR_HEIGHT }}
        showsVerticalScrollIndicator={false}
      >
        {/* Guest Banner */}
        {isAnonymous && (
          <TouchableOpacity
            style={styles.guestBanner}
            onPress={() => router.push('/(auth)/create-account')}
            activeOpacity={0.9}
          >
            <View style={styles.guestBannerContent}>
              <View style={styles.guestBannerIconContainer}>
                <Ionicons
                  name="cloud-upload"
                  size={24}
                  color={colors.brandPrimary}
                />
              </View>
              <View style={styles.guestBannerText}>
                <Text style={styles.guestBannerTitle}>Create an Account</Text>
                <Text style={styles.guestBannerSubtitle}>
                  Sync your data across devices and never lose your progress
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.brandPrimary}
              />
            </View>
          </TouchableOpacity>
        )}

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.profileCard}>
            <View style={styles.profileDetails}>
              <View style={styles.detailRow}>
                <View style={styles.detailLabelContainer}>
                  <Ionicons name="at" size={20} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>User Tag</Text>
                </View>
                <Text style={styles.detailValue}>
                  @{profile?.user_tag || 'Not set'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailLabelContainer}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.detailLabel}>Email</Text>
                </View>
                {isAnonymous ? (
                  <TouchableOpacity
                    onPress={() => router.push('/(auth)/create-account')}
                    style={styles.linkAccountButton}
                  >
                    <Text style={styles.linkAccountText}>Link Account</Text>
                    <Ionicons
                      name="add-circle"
                      size={18}
                      color={colors.brandPrimary}
                    />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.detailValue}>
                    {user?.email || 'Not set'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>

          <View style={styles.subscriptionCard}>
            {/* Status */}
            <View style={styles.subscriptionRow}>
              <View style={styles.subscriptionLeft}>
                <Text style={styles.subscriptionLabel}>Status</Text>
              </View>
              <View style={styles.subscriptionStatusBadge}>
                <Text
                  style={[
                    styles.subscriptionStatusText,
                    isProMember && styles.subscriptionStatusTextActive,
                  ]}
                >
                  {getSubscriptionStatus()}
                </Text>
              </View>
            </View>

            {/* Next Billing Date (if subscribed) */}
            {isProMember && getNextBillingDate() && (
              <>
                <View style={styles.subscriptionDivider} />
                <View style={styles.subscriptionRow}>
                  <View style={styles.subscriptionLeft}>
                    <Text style={styles.subscriptionLabel}>
                      {getSubscriptionStatus() === 'trial'
                        ? 'Trial Ends'
                        : 'Renews'}
                    </Text>
                  </View>
                  <Text style={styles.subscriptionValue}>
                    {getNextBillingDate()}
                  </Text>
                </View>
              </>
            )}

            {/* Divider */}
            <View style={styles.subscriptionDivider} />

            {/* Restore Purchases */}
            <TouchableOpacity
              style={styles.subscriptionButton}
              onPress={handleRestorePurchases}
              disabled={isRestoring}
            >
              <Ionicons
                name="refresh-outline"
                size={20}
                color={colors.brandPrimary}
              />
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              ) : (
                <Text style={styles.subscriptionButtonText}>
                  Restore Purchases
                </Text>
              )}
            </TouchableOpacity>

            {/* Manage Subscription (if subscribed) */}
            {isProMember && (
              <>
                <View style={styles.subscriptionDivider} />
                <TouchableOpacity
                  style={styles.subscriptionButton}
                  onPress={handleManageSubscription}
                >
                  <Ionicons
                    name="settings-outline"
                    size={20}
                    color={colors.brandPrimary}
                  />
                  <Text style={styles.subscriptionButtonText}>
                    Manage Subscription
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.preferenceCard}>
            {/* Unit Toggle */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View>
                  <Text style={styles.preferenceTitle}>Weight Units</Text>
                </View>
              </View>
              <View style={styles.unitToggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    weightUnit === 'kg' && styles.unitButtonActive,
                  ]}
                  onPress={() => setWeightUnit('kg')}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      weightUnit === 'kg' && styles.unitButtonTextActive,
                    ]}
                  >
                    kg
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    weightUnit === 'lb' && styles.unitButtonActive,
                  ]}
                  onPress={() => setWeightUnit('lb')}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      weightUnit === 'lb' && styles.unitButtonTextActive,
                    ]}
                  >
                    lbs
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.preferenceDivider} />

            {/* Coach Selector */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View>
                  <Text style={styles.preferenceTitle}>AI Coach</Text>
                  <Text style={styles.preferenceDescription}>
                    {getCoach(profile?.coach).name}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.unitToggleContainer}
                onPress={() => router.push('/coach-selection')}
              >
                <View style={styles.unitButton}>
                  <Text style={styles.unitButtonText}>Change</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.preferenceDivider} />

            {/* Theme Selector */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View>
                  <Text style={styles.preferenceTitle}>Theme</Text>
                </View>
              </View>
              <View style={styles.unitToggleContainer}>
                {(['light', 'dark', 'system'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.unitButton,
                      themePreference === option && styles.unitButtonActive,
                    ]}
                    onPress={() => setThemePreference(option)}
                  >
                    <Text
                      style={[
                        styles.unitButtonText,
                        themePreference === option &&
                          styles.unitButtonTextActive,
                      ]}
                    >
                      {option === 'system'
                        ? 'System'
                        : option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Divider */}
            <View style={styles.preferenceDivider} />

            {/* Privacy Toggle */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View>
                  <Text style={styles.preferenceTitle}>Private Profile</Text>
                  <Text style={styles.preferenceDescription}>
                    Only approved followers can see your workouts, comments, and
                    likes.
                  </Text>
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

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.preferenceCard}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <Text style={styles.preferenceTitle}>Workout Reminders</Text>
                <Text style={styles.preferenceDescription}>
                  Off-app reminders to help you stay consistent.
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={(value) =>
                  handleToggleRetention('enabled', value)
                }
                disabled={isPushSettingsUpdating || !retentionPrefs}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={
                  notificationsEnabled ? colors.brandPrimary : '#F3F4F6'
                }
              />
            </View>

            <View style={styles.preferenceDivider} />

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <Text style={styles.preferenceTitle}>Scheduled Workout</Text>
                <Text style={styles.preferenceDescription}>
                  Nudge near your preferred training hour.
                </Text>
              </View>
              <Switch
                value={retentionPrefs?.scheduled_reminders_enabled ?? false}
                onValueChange={(value) =>
                  handleToggleRetention('scheduled_reminders_enabled', value)
                }
                disabled={
                  isPushSettingsUpdating ||
                  !retentionPrefs ||
                  !notificationsEnabled
                }
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={
                  retentionPrefs?.scheduled_reminders_enabled
                    ? colors.brandPrimary
                    : '#F3F4F6'
                }
              />
            </View>

            <View style={styles.preferenceDivider} />

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <Text style={styles.preferenceTitle}>Streak Protection</Text>
                <Text style={styles.preferenceDescription}>
                  Evening reminder when your streak is in danger.
                </Text>
              </View>
              <Switch
                value={retentionPrefs?.streak_protection_enabled ?? false}
                onValueChange={(value) =>
                  handleToggleRetention('streak_protection_enabled', value)
                }
                disabled={
                  isPushSettingsUpdating ||
                  !retentionPrefs ||
                  !notificationsEnabled
                }
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={
                  retentionPrefs?.streak_protection_enabled
                    ? colors.brandPrimary
                    : '#F3F4F6'
                }
              />
            </View>

            <View style={styles.preferenceDivider} />

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <Text style={styles.preferenceTitle}>Inactivity Nudges</Text>
                <Text style={styles.preferenceDescription}>
                  Comeback reminders after a few days away.
                </Text>
              </View>
              <Switch
                value={retentionPrefs?.inactivity_enabled ?? false}
                onValueChange={(value) =>
                  handleToggleRetention('inactivity_enabled', value)
                }
                disabled={
                  isPushSettingsUpdating ||
                  !retentionPrefs ||
                  !notificationsEnabled
                }
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={
                  retentionPrefs?.inactivity_enabled
                    ? colors.brandPrimary
                    : '#F3F4F6'
                }
              />
            </View>

            <View style={styles.preferenceDivider} />

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <Text style={styles.preferenceTitle}>Weekly Recap</Text>
                <Text style={styles.preferenceDescription}>
                  Monday recap to kick off your week.
                </Text>
              </View>
              <Switch
                value={retentionPrefs?.weekly_recaps_enabled ?? false}
                onValueChange={(value) =>
                  handleToggleRetention('weekly_recaps_enabled', value)
                }
                disabled={
                  isPushSettingsUpdating ||
                  !retentionPrefs ||
                  !notificationsEnabled
                }
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={
                  retentionPrefs?.weekly_recaps_enabled
                    ? colors.brandPrimary
                    : '#F3F4F6'
                }
              />
            </View>

            <View style={styles.preferenceDivider} />

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <Text style={styles.preferenceTitle}>Milestones</Text>
                <Text style={styles.preferenceDescription}>
                  Celebrate major training milestones.
                </Text>
              </View>
              <Switch
                value={retentionPrefs?.milestones_enabled ?? false}
                onValueChange={(value) =>
                  handleToggleRetention('milestones_enabled', value)
                }
                disabled={
                  isPushSettingsUpdating ||
                  !retentionPrefs ||
                  !notificationsEnabled
                }
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={
                  retentionPrefs?.milestones_enabled
                    ? colors.brandPrimary
                    : '#F3F4F6'
                }
              />
            </View>

            <View style={styles.preferenceDivider} />

            <View style={styles.preferenceLeft}>
              <Text style={styles.preferenceTitle}>Reminder Time</Text>
              <Text style={styles.preferenceDescription}>
                Quiet hours are fixed at 10:00 PM to 8:00 AM.
              </Text>
              <View style={styles.notificationPillGroup}>
                {reminderHourOptions.map((hour) => {
                  const isActive = retentionPrefs?.preferred_reminder_hour === hour
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.notificationPillButton,
                        isActive && styles.notificationPillButtonActive,
                      ]}
                      onPress={() => handleUpdateReminderHour(hour)}
                      disabled={
                        isPushSettingsUpdating ||
                        !retentionPrefs ||
                        !notificationsEnabled
                      }
                    >
                      <Text
                        style={[
                          styles.notificationPillButtonText,
                          isActive && styles.notificationPillButtonTextActive,
                        ]}
                      >
                        {formatHourLabel(hour)}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            <View style={styles.preferenceDivider} />

            <View style={styles.preferenceLeft}>
              <Text style={styles.preferenceTitle}>Global Snooze</Text>
              <Text style={styles.preferenceDescription}>
                Pause all reminder categories for a while.
              </Text>
              <View style={styles.notificationPillGroup}>
                {[1, 3, 7].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={styles.notificationPillButton}
                    onPress={() =>
                      handleSnoozeNotifications(days as 1 | 3 | 7)
                    }
                    disabled={isPushSettingsUpdating || !retentionPrefs}
                  >
                    <Text style={styles.notificationPillButtonText}>
                      {days}d
                    </Text>
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
                <Text style={styles.preferenceDescription}>
                  Snoozed until {snoozedUntilLabel}
                </Text>
              )}
            </View>

            <View style={styles.preferenceDivider} />

            <TouchableOpacity
              style={styles.testNotificationButton}
              onPress={handleTestNotification}
              disabled={isSendingTestNotification}
            >
              {isSendingTestNotification ? (
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              ) : (
                <>
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color={colors.brandPrimary}
                  />
                  <Text style={styles.testNotificationButtonText}>
                    Send Test Notification
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Community Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleOpenFollowRequests}
            activeOpacity={0.8}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="people-outline"
                size={22}
                color={colors.textSecondary}
              />
              <View>
                <Text style={styles.actionButtonTextNeutral}>
                  Follow Requests
                </Text>
                <Text style={styles.actionButtonSubtext}>
                  Approve new followers or cancel pending invites.
                </Text>
              </View>
            </View>
            <View style={styles.followRequestRight}>
              {pendingRequestCount > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>
                    {pendingRequestCount > 99 ? '99+' : pendingRequestCount}
                  </Text>
                </View>
              )}
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleContactSupport}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="mail-outline"
                size={22}
                color={colors.textSecondary}
              />
              <View>
                <Text style={styles.actionButtonTextNeutral}>
                  Contact Support
                </Text>
                <Text style={styles.supportEmail}>support@repaifit.app</Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={handleOpenPrivacyPolicy}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons
                  name="shield-outline"
                  size={22}
                  color={colors.textSecondary}
                />
                <Text style={styles.actionButtonTextNeutral}>Privacy Policy</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            <View style={styles.cardDivider} />

            <TouchableOpacity
              style={styles.cardRow}
              onPress={handleOpenTermsOfUse}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={colors.textSecondary}
                />
                <Text style={styles.actionButtonTextNeutral}>Terms of Use</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="log-out-outline"
                size={22}
                color={colors.textSecondary}
              />
              <Text style={styles.actionButtonTextNeutral}>Sign Out</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleDeleteAccount}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="trash-outline" size={22} color={colors.statusError} />
              <Text style={styles.dangerButtonText}>Delete Account</Text>
            </View>
          </TouchableOpacity>
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
    },
    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    avatarWrapper: {
      position: 'relative',
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.surfaceSubtle,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarEditButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    profileDetails: {
      gap: 20,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    detailLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    detailLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    detailValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      justifyContent: 'flex-end',
    },
    detailValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'right',
    },
    editButton: {
      padding: 4,
    },
    actionButton: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 18,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
    },
    cardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 18,
    },
    cardDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    actionButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
    followRequestRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pendingBadge: {
      minWidth: 28,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: colors.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingBadgeText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: '700',
    },
    supportEmail: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    dangerButton: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 18,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    dangerButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.statusError,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalInput: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalCancelButton: {
      flex: 1,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    modalSaveButton: {
      flex: 1,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSaveButtonDisabled: {
      opacity: 0.5,
    },
    modalSaveText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.surface,
    },
    preferenceCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    preferenceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    unitToggleContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 20,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    unitButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
    },
    unitButtonActive: {
      backgroundColor: colors.brandPrimary,
    },
    unitButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    unitButtonTextActive: {
      color: colors.surface,
    },
    preferenceLeft: {
      flex: 1,
    },
    preferenceTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    preferenceDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    preferenceDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    notificationPillGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    notificationPillButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
    },
    notificationPillButtonActive: {
      backgroundColor: colors.brandPrimary,
      borderColor: colors.brandPrimary,
    },
    notificationPillButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    notificationPillButtonTextActive: {
      color: colors.surface,
    },
    testNotificationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 10,
      paddingVertical: 10,
    },
    testNotificationButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    subscriptionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subscriptionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    subscriptionLeft: {
      flex: 1,
    },
    subscriptionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    subscriptionValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    subscriptionStatusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceSubtle,
    },
    subscriptionStatusText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    subscriptionStatusTextActive: {
      color: colors.brandPrimary,
    },
    subscriptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    subscriptionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    subscriptionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    guestBanner: {
      marginHorizontal: 20,
      marginTop: 20,
      backgroundColor: colors.brandPrimary + '12',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.brandPrimary + '30',
      overflow: 'hidden',
    },
    guestBannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 12,
    },
    guestBannerIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.brandPrimary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    guestBannerText: {
      flex: 1,
    },
    guestBannerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    guestBannerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    linkAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    linkAccountText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
  })
