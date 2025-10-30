import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useSubscription } from '@/contexts/subscription-context'

type PaywallProps = {
  visible: boolean
  onClose: () => void
  title?: string
  message?: string
}

export function Paywall({
  visible,
  onClose,
  title = 'Premium Feature',
  message = 'This feature requires a subscription to Rep AI.',
}: PaywallProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const { purchasePackage, restorePurchases, offerings, isLoading } =
    useSubscription()
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const handleSubscribe = async () => {
    try {
      setIsPurchasing(true)

      if (!offerings) {
        Alert.alert('Error', 'Unable to load subscription options. Please try again.')
        return
      }

      // Find the monthly package
      const monthlyPackage = offerings.availablePackages.find(
        (pkg) => pkg.identifier === '$rc_monthly' || pkg.identifier.toLowerCase().includes('monthly')
      )

      const packageToUse = monthlyPackage || offerings.availablePackages[0]

      if (!packageToUse) {
        Alert.alert('Error', 'No subscription packages available. Please try again.')
        return
      }

      const updatedCustomerInfo = await purchasePackage(packageToUse.identifier)

      // Verify the Pro entitlement was actually granted
      const hasProEntitlement = Boolean(updatedCustomerInfo?.entitlements.active['Pro'])

      if (hasProEntitlement) {
        // Purchase successful and entitlement verified - close the paywall
        Alert.alert('Success!', 'Your subscription is now active. Enjoy all premium features!', [
          { text: 'OK', onPress: onClose }
        ])
      } else {
        // Purchase succeeded but entitlement not granted - this is rare but possible
        Alert.alert(
          'Subscription Pending',
          'Your purchase was successful, but it may take a moment to activate. Please restart the app if you still don\'t have access.',
          [{ text: 'OK' }]
        )
      }
    } catch (error: any) {
      // Handle user cancellation
      if (error?.userCancelled) {
        console.log('[Paywall] User cancelled purchase')
        return
      }

      Alert.alert(
        'Purchase Failed',
        error?.message || 'Unable to complete purchase. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleRestore = async () => {
    try {
      setIsRestoring(true)
      const restoredCustomerInfo = await restorePurchases()

      // Check if Pro entitlement was restored
      const hasProEntitlement = Boolean(restoredCustomerInfo?.entitlements.active['Pro'])

      if (hasProEntitlement) {
        Alert.alert('Success!', 'Your purchases have been restored.', [
          { text: 'OK', onPress: onClose }
        ])
      } else {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found for this account.',
          [{ text: 'OK' }]
        )
      }
    } catch {
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setIsRestoring(false)
    }
  }

  const handleOpenTerms = async () => {
    const termsUrl = 'https://www.repaifit.app/terms'
    try {
      const canOpen = await Linking.canOpenURL(termsUrl)
      if (canOpen) {
        await Linking.openURL(termsUrl)
      }
    } catch (error) {
      console.error('[Paywall] Failed to open terms:', error)
    }
  }

  const monthlyPrice = offerings?.availablePackages.find(
    (pkg) => pkg.identifier === '$rc_monthly' || pkg.identifier.toLowerCase().includes('monthly')
  )?.product.priceString || '$5.99'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollableContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={64} color={colors.primary} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <Benefit
                icon="document-text"
                text="Unlimited workout logging"
                colors={colors}
              />
              <Benefit
                icon="chatbubbles"
                text="AI-powered fitness assistant"
                colors={colors}
              />
              <Benefit
                icon="trending-up"
                text="Track all your PRs"
                colors={colors}
              />
              <Benefit
                icon="body"
                text="Body scanning & analysis"
                colors={colors}
              />
            </View>

            {/* Pricing */}
            <View style={styles.pricingContainer}>
              <Text style={styles.pricingText}>
                7 days free, then {monthlyPrice}/month
              </Text>
              <Text style={styles.pricingSubtext}>Cancel anytime</Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={handleSubscribe}
              disabled={isPurchasing || isRestoring || isLoading}
            >
              {isPurchasing ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.subscribeButtonText}>Start Free Trial</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isPurchasing || isRestoring || isLoading}
            >
              {isRestoring ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              )}
            </TouchableOpacity>

            {/* Terms of Service Link */}
            <TouchableOpacity onPress={handleOpenTerms} style={styles.termsLink}>
              <Text style={styles.termsText}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function Benefit({
  icon,
  text,
  colors,
}: {
  icon: any
  text: string
  colors: any
}) {
  const styles = createStyles(colors)

  return (
    <View style={styles.benefit}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  )
}

function createStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      flexDirection: 'column',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 10,
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollableContent: {
      flex: 1,
    },
    scrollContentContainer: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    message: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 24,
    },
    benefitsContainer: {
      gap: 16,
      marginBottom: 32,
    },
    benefit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    benefitText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    pricingContainer: {
      alignItems: 'center',
      paddingVertical: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      marginBottom: 8,
    },
    pricingText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    pricingSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    actions: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      paddingTop: 8,
      gap: 12,
    },
    subscribeButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    subscribeButtonText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
    restoreButton: {
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    restoreButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    termsLink: {
      marginTop: -8,
      paddingVertical: 0,
      alignItems: 'center',
    },
    termsText: {
      fontSize: 12,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
      opacity: 0.7,
    },
  })
}
