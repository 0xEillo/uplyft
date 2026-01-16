import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
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
import { SafeAreaView } from 'react-native-safe-area-context'

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
  }, [loadProfile, loadPendingRequests])

  useFocusEffect(
    useCallback(() => {
      loadPendingRequests()
    }, [loadPendingRequests]),
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <BaseNavbar
          leftContent={
            <NavbarIsland>
              <TouchableOpacity
                onPress={handleGoBack}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={<Text style={styles.headerTitle}>Settings</Text>}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={
          <NavbarIsland>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          </NavbarIsland>
        }
        centerContent={<Text style={styles.headerTitle}>Settings</Text>}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
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
                  color={colors.primary}
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
                color={colors.primary}
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
                      color={colors.primary}
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
                color={colors.primary}
              />
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.primary} />
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
                    color={colors.primary}
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
                trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
                thumbColor={profile?.is_private ? colors.primary : '#F3F4F6'}
              />
            </View>
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
                color={colors.textLight}
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
              color={colors.textLight}
            />
          </TouchableOpacity>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <TouchableOpacity
            style={styles.actionButton}
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
              color={colors.textLight}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.legalButtonSpacing]}
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
              color={colors.textLight}
            />
          </TouchableOpacity>
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
              color={colors.textLight}
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
              <Ionicons name="trash-outline" size={22} color={colors.error} />
              <Text style={styles.dangerButtonText}>Delete Account</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    backButton: {
      zIndex: 1,
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
      marginTop: 24,
      paddingHorizontal: 14,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    profileCard: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
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
      backgroundColor: colors.backgroundLight,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary,
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
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.white,
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
      color: colors.text,
      textAlign: 'right',
    },
    editButton: {
      padding: 4,
    },
    actionButton: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 18,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    legalButtonSpacing: {
      marginTop: 6,
    },
    actionButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    actionButtonTextNeutral: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
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
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingBadgeText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '700',
    },
    supportEmail: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    dangerButton: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 18,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    dangerButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.error,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.white,
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
      color: colors.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalInput: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
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
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    modalSaveButton: {
      flex: 1,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSaveButtonDisabled: {
      opacity: 0.5,
    },
    modalSaveText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.white,
    },
    preferenceCard: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    preferenceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    unitToggleContainer: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundLight,
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
      backgroundColor: colors.primary,
    },
    unitButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    unitButtonTextActive: {
      color: colors.white,
    },
    preferenceLeft: {
      flex: 1,
    },
    preferenceTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
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
    subscriptionCard: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
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
      color: colors.text,
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
      backgroundColor: colors.backgroundLight,
    },
    subscriptionStatusText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    subscriptionStatusTextActive: {
      color: colors.primary,
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
      color: colors.primary,
    },
    subscriptionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    guestBanner: {
      marginHorizontal: 14,
      marginTop: 16,
      backgroundColor: colors.primary + '12',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.primary + '30',
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
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    guestBannerText: {
      flex: 1,
    },
    guestBannerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
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
      color: colors.primary,
    },
  })
