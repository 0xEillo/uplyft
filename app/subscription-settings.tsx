import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
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

export default function SubscriptionSettingsScreen() {
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const colors = useThemedColors()
  const { isProMember, customerInfo, restorePurchases } = useSubscription()
  const [isRestoring, setIsRestoring] = useState(false)
  const insets = useSafeAreaInsets()
  const NAVBAR_HEIGHT = 76

  useEffect(() => {
    trackEvent('subscription_settings_viewed')
  }, [trackEvent])

  const handleRestorePurchases = async () => {
    try {
      setIsRestoring(true)
      const restoredCustomerInfo = await restorePurchases()

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

  const styles = createStyles(colors)

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
          centerContent={<Text style={styles.headerTitle}>Subscription</Text>}
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
          <Text style={styles.sectionTitle}>Subscription Details</Text>
          <View style={styles.card}>
            <View style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="star-outline" size={22} color={colors.brandPrimary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Status</Text>
                  <Text style={styles.actionButtonSubtext}>Your current tier</Text>
                </View>
              </View>
              <View style={styles.statusBadge}>
                <Text style={[styles.statusText, isProMember && styles.statusTextActive]}>
                  {getSubscriptionStatus()}
                </Text>
              </View>
            </View>

            {isProMember && getNextBillingDate() && (
              <>
                <View style={styles.cardDivider} />
                <View style={styles.actionButton}>
                  <View style={styles.actionButtonContent}>
                    <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionButtonTextNeutral}>
                        {getSubscriptionStatus() === 'trial' ? 'Trial Ends' : 'Renews'}
                      </Text>
                      <Text style={styles.actionButtonSubtext}>Next billing date</Text>
                    </View>
                  </View>
                  <Text style={styles.valueText}>{getNextBillingDate()}</Text>
                </View>
              </>
            )}

            <View style={styles.cardDivider} />

            <TouchableOpacity style={styles.actionButton} onPress={handleRestorePurchases} disabled={isRestoring}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonTextNeutral}>Restore Purchases</Text>
                  <Text style={styles.actionButtonSubtext}>Restore a previous purchase</Text>
                </View>
              </View>
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              )}
            </TouchableOpacity>

            {isProMember && (
              <>
                <View style={styles.cardDivider} />
                <TouchableOpacity style={styles.actionButton} onPress={handleManageSubscription}>
                  <View style={styles.actionButtonContent}>
                    <Ionicons name="open-outline" size={22} color={colors.textSecondary} />
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionButtonTextNeutral}>Manage Subscription</Text>
                      <Text style={styles.actionButtonSubtext}>Change or cancel plans</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </>
            )}
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
    valueText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceSubtle,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    statusTextActive: {
      color: colors.brandPrimary,
    },
  })
