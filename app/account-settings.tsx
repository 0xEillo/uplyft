import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { AnalyticsEvents } from '@/constants/analytics-events'
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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function SettingsScreen() {
  const { user, signOut, isAnonymous } = useAuth()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>()
  const colors = useThemedColors()
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const insets = useSafeAreaInsets()
  const NAVBAR_HEIGHT = 76
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

  const SettingsItem = ({
    icon,
    title,
    description,
    onPress,
    rightContent,
    isDestructive,
  }: {
    icon: keyof typeof Ionicons.glyphMap
    title: string
    description?: string
    onPress?: () => void
    rightContent?: React.ReactNode
    isDestructive?: boolean
  }) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={styles.actionButtonContent}>
        <Ionicons
          name={icon}
          size={22}
          color={isDestructive ? colors.statusError : colors.textSecondary}
        />
        <View style={styles.actionTextContainer}>
          <Text
            style={
              isDestructive
                ? styles.dangerButtonText
                : styles.actionButtonTextNeutral
            }
          >
            {title}
          </Text>
          {description && (
            <Text style={styles.actionButtonSubtext}>{description}</Text>
          )}
        </View>
      </View>
      {rightContent || <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
    </TouchableOpacity>
  )

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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + NAVBAR_HEIGHT },
        ]}
        scrollIndicatorInsets={{ top: insets.top + NAVBAR_HEIGHT }}
        showsVerticalScrollIndicator={false}
      >
        {isAnonymous && (
          <TouchableOpacity
            style={styles.guestBanner}
            onPress={() => router.push('/(auth)/create-account')}
            activeOpacity={0.9}
          >
            <View style={styles.guestBannerContent}>
              <View style={styles.guestBannerIconContainer}>
                <Ionicons name="cloud-upload" size={24} color={colors.brandPrimary} />
              </View>
              <View style={styles.guestBannerText}>
                <Text style={styles.guestBannerTitle}>Create an Account</Text>
                <Text style={styles.guestBannerSubtitle}>
                  Sync your data across devices and never lose your progress
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.brandPrimary} />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.card}>
            <SettingsItem
              icon="person-outline"
              title="Account Information"
              description="User tag and email settings"
              onPress={() => router.push('/account-info-settings')}
            />
            <View style={styles.cardDivider} />
            <SettingsItem
              icon="star-outline"
              title="Subscription"
              description="Manage your Pro membership"
              onPress={() => router.push('/subscription-settings')}
            />
            <View style={styles.cardDivider} />
            <SettingsItem
              icon="options-outline"
              title="Preferences"
              description="Theme, units, and privacy"
              onPress={() => router.push('/preferences-settings')}
            />
            <View style={styles.cardDivider} />
            <SettingsItem
              icon="notifications-outline"
              title="Notifications"
              description="Workout reminders and streak protection"
              onPress={() => router.push('/notification-settings')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community & Support</Text>
          <View style={styles.card}>
            <SettingsItem
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
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              }
            />
            <View style={styles.cardDivider} />
            <SettingsItem
              icon="mail-outline"
              title="Contact Support"
              description="support@repaifit.app"
              onPress={handleContactSupport}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.card}>
            <SettingsItem
              icon="shield-outline"
              title="Privacy Policy"
              description="Read our privacy policy"
              onPress={handleOpenPrivacyPolicy}
            />
            <View style={styles.cardDivider} />
            <SettingsItem
              icon="document-text-outline"
              title="Terms of Use"
              description="Read our terms of service"
              onPress={handleOpenTermsOfUse}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.card}>
            <SettingsItem
              icon="log-out-outline"
              title="Sign Out"
              description="Log out of your account on this device"
              onPress={handleSignOut}
              rightContent={<View />}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={[styles.card, { borderColor: colors.statusError + '40' }]}>
            <SettingsItem
              icon="trash-outline"
              title="Delete Account"
              description="Permanently delete your data"
              onPress={handleDeleteAccount}
              isDestructive
              rightContent={<View />}
            />
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
    dangerButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.statusError,
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
  })
