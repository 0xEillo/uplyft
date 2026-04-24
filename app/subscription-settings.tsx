import {
  SettingsCard,
  SettingsRow,
  SettingsScreen,
  SettingsSection,
} from '@/components/ui/settings'
import {
  FontSize,
  FontWeight,
  IconSize,
  Radius,
  Spacing,
  Typography,
} from '@/constants/theme'
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
  StyleSheet,
  Text,
  View,
} from 'react-native'

export default function SubscriptionSettingsScreen() {
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const colors = useThemedColors()
  const { isProMember, customerInfo, restorePurchases } = useSubscription()
  const [isRestoring, setIsRestoring] = useState(false)

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
    if (!proEntitlement) return 'free'
    if (proEntitlement.periodType === 'trial') return 'trial'
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
  const status = getSubscriptionStatus()
  const nextBillingDate = getNextBillingDate()

  return (
    <SettingsScreen title="Subscription" onBack={() => router.back()}>
      <SettingsSection title="Subscription Details">
        <SettingsCard>
          <SettingsRow
            icon="star-outline"
            title="Status"
            description="Your current tier"
            rightContent={
              <View style={styles.statusBadge}>
                <Text style={[styles.statusText, isProMember && styles.statusTextActive]}>
                  {status}
                </Text>
              </View>
            }
          />
          {isProMember && nextBillingDate ? (
            <SettingsRow
              icon="calendar-outline"
              title={status === 'trial' ? 'Trial Ends' : 'Renews'}
              description="Next billing date"
              rightContent={
                <Text style={styles.valueText}>{nextBillingDate}</Text>
              }
            />
          ) : null}
          <SettingsRow
            icon="refresh-outline"
            title="Restore Purchases"
            description="Restore a previous purchase"
            onPress={handleRestorePurchases}
            disabled={isRestoring}
            rightContent={
              isRestoring ? (
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={IconSize.md}
                  color={colors.textMuted}
                />
              )
            }
          />
          {isProMember ? (
            <SettingsRow
              icon="open-outline"
              title="Manage Subscription"
              description="Change or cancel plans"
              onPress={handleManageSubscription}
            />
          ) : null}
        </SettingsCard>
      </SettingsSection>
    </SettingsScreen>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    valueText: {
      ...Typography.body,
      fontWeight: FontWeight.semibold,
      color: colors.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs + 2,
      borderRadius: Radius.lg,
      backgroundColor: colors.surfaceSubtle,
    },
    statusText: {
      fontSize: FontSize.sm + 1,
      fontWeight: FontWeight.semibold,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    statusTextActive: {
      color: colors.brandPrimary,
    },
  })
