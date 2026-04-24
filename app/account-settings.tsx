import { AnalyticsEvents } from '@/constants/analytics-events'
import {
  FontSize,
  FontWeight,
  IconSize,
  Layout,
  Opacity,
  Radius,
  Spacing,
  Typography,
} from '@/constants/theme'
import {
  SettingsCard,
  SettingsRow,
  SettingsScreen,
  SettingsSection,
} from '@/components/ui/settings'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

export default function SettingsScreenRoute() {
  const { user, signOut, isAnonymous } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>()
  const colors = useThemedColors()
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const resolvedReturnTo =
    Array.isArray(returnTo) && returnTo.length > 0 ? returnTo[0] : returnTo

  const loadPendingRequests = useCallback(async () => {
    if (!user) return

    try {
      const count = await database.followRequests.countIncomingPending(user.id)
      setPendingRequestCount(count)
    } catch (error) {
      console.error('Error loading follow requests count:', error)
    }
  }, [user])

  const handleGoBack = useCallback(() => {
    if (resolvedReturnTo && typeof resolvedReturnTo === 'string') {
      router.replace(resolvedReturnTo as any)
      return
    }
    router.back()
  }, [resolvedReturnTo, router])

  useEffect(() => {
    loadPendingRequests()
  }, [loadPendingRequests])

  useEffect(() => {
    trackEvent(AnalyticsEvents.SETTINGS_VIEWED)
  }, [trackEvent])

  useFocusEffect(
    useCallback(() => {
      loadPendingRequests()
    }, [loadPendingRequests]),
  )

  const handleSignOut = async () => {
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

  const styles = createStyles(colors)

  return (
    <SettingsScreen title="Settings" onBack={handleGoBack}>
      {isAnonymous && (
        <TouchableOpacity
          style={styles.guestBanner}
          onPress={() => router.push('/(auth)/create-account')}
          activeOpacity={Opacity.pressed}
        >
          <View style={styles.guestBannerContent}>
            <View style={styles.guestBannerIconContainer}>
              <Ionicons name="cloud-upload" size={IconSize.xl} color={colors.brandPrimary} />
            </View>
            <View style={styles.guestBannerText}>
              <Text style={styles.guestBannerTitle}>Create an Account</Text>
              <Text style={styles.guestBannerSubtitle}>
                Sync your data across devices and never lose your progress
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={IconSize.md} color={colors.brandPrimary} />
          </View>
        </TouchableOpacity>
      )}

      <SettingsSection title="General">
        <SettingsCard>
          <SettingsRow
            icon="person-outline"
            title="Account Information"
            description="User tag and email settings"
            onPress={() => router.push('/account-info-settings')}
          />
          <SettingsRow
            icon="star-outline"
            title="Subscription"
            description="Manage your Pro membership"
            onPress={() => router.push('/subscription-settings')}
          />
          <SettingsRow
            icon="options-outline"
            title="Preferences"
            description="Theme, units, and privacy"
            onPress={() => router.push('/preferences-settings')}
          />
          <SettingsRow
            icon="notifications-outline"
            title="Notifications"
            description="Workout reminders and streak protection"
            onPress={() => router.push('/notification-settings')}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Community & Support">
        <SettingsCard>
          <SettingsRow
            icon="people-outline"
            title="Follow Requests"
            description="Approve new followers or cancel invites"
            onPress={() => router.push('/follow-requests')}
            rightContent={
              <View style={styles.followRequestRight}>
                {pendingRequestCount > 0 && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>
                      {pendingRequestCount > 99 ? '99+' : pendingRequestCount}
                    </Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
              </View>
            }
          />
          <SettingsRow
            icon="mail-outline"
            title="Contact Support"
            description="support@repaifit.app"
            onPress={handleContactSupport}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Legal">
        <SettingsCard>
          <SettingsRow
            icon="shield-outline"
            title="Privacy Policy"
            description="Read our privacy policy"
            onPress={handleOpenPrivacyPolicy}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Terms of Use"
            description="Read our terms of service"
            onPress={handleOpenTermsOfUse}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Actions">
        <SettingsCard>
          <SettingsRow
            icon="log-out-outline"
            title="Sign Out"
            description="Log out of your account on this device"
            onPress={handleSignOut}
            rightContent={null}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <SettingsCard tone="destructive">
          <SettingsRow
            icon="trash-outline"
            title="Delete Account"
            description="Permanently delete your data"
            onPress={handleDeleteAccount}
            destructive
            rightContent={null}
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsScreen>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    guestBanner: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      backgroundColor: colors.brandPrimary + '12',
      borderRadius: Radius.lg,
      borderWidth: 2,
      borderColor: colors.brandPrimary + '30',
      overflow: 'hidden',
    },
    guestBannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.base,
      gap: Spacing.md,
    },
    guestBannerIconContainer: {
      width: Layout.tapTarget,
      height: Layout.tapTarget,
      borderRadius: Radius.pill,
      backgroundColor: colors.brandPrimary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    guestBannerText: {
      flex: 1,
    },
    guestBannerTitle: {
      ...Typography.bodyLargeSemibold,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: Spacing.xxs,
    },
    guestBannerSubtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    followRequestRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    pendingBadge: {
      minWidth: 28,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.pill,
      backgroundColor: colors.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingBadgeText: {
      fontSize: FontSize.tiny,
      fontWeight: FontWeight.bold,
      color: colors.surface,
    },
  })
