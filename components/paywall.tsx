import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import {
  useRevenueCatPackages
} from '@/hooks/useRevenueCatPackages'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type PaywallProps = {
  visible: boolean
  onClose: () => void
  title?: string
  message?: string
}

export function Paywall({
  visible,
  onClose,
  title = 'Unlock Your Full Potential',
  message = 'Get full access to all premium features',
}: PaywallProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
  const styles = createStyles(colors, screenHeight)

  const { user } = useAuth()
  const {
    purchasePackage,
    restorePurchases,
    offerings,
    isLoading: subscriptionLoading,
  } = useSubscription()

  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(1) // Default to Yearly
  const [isTrialEnabled, setIsTrialEnabled] = useState(true)

  const {
    monthly: monthlyPackage,
    yearly: yearlyPackage,
    lifetime: lifetimePackage,
  } = useRevenueCatPackages(offerings)

  // Plans array matching trial-offer layout
  const plans = useMemo(() => {
    const monthlyPrice = monthlyPackage?.product.priceString || 'US$5.99'
    const yearlyPrice = yearlyPackage?.product.priceString || 'US$24.99'

    // Calculate per month price for yearly plan
    const extractPrice = (priceStr: string) => {
      const match = priceStr.match(/[\d,]+\.?\d*/)
      if (!match) return 0
      return parseFloat(match[0].replace(',', '.'))
    }

    const yearlyPriceNum = extractPrice(yearlyPrice)
    const perMonthPrice = yearlyPriceNum / 12

    // Get currency symbol from price string
    const getCurrencySymbol = (priceStr: string) => {
      const match = priceStr.match(/[^\d,.\s]+/)
      return match ? match[0] : '$'
    }

    const currencySymbol = getCurrencySymbol(yearlyPrice)
    const perMonthFormatted = `${currencySymbol}${perMonthPrice.toFixed(2)}/mo`

    return [
      {
        type: 'monthly',
        package: monthlyPackage,
        label: 'Monthly',
        subtitle: null,
        price: `${monthlyPrice} / mo.`,
        popular: false,
        bestValue: false,
      },
      {
        type: 'yearly',
        package: yearlyPackage,
        label: 'Yearly',
        subtitle: `${yearlyPrice} / yr.`,
        price: `${perMonthFormatted}.`,
        popular: false,
        bestValue: true,
        badge: '70% OFF Limited Time Offer',
      },
    ]
  }, [yearlyPackage, monthlyPackage])

  const selectedPackage = plans[selectedPlanIndex].package

  // Get hero image based on user gender (if available)
  const getHeroImage = () => {
    // Default to male image, can be extended to read user profile
    return require('@/assets/images/onboarding/male_muscle_flex.png')
  }

  // Dynamic button text based on trial toggle
  const buttonText = useMemo(() => {
    if (isTrialEnabled) {
      return 'Start Free Trial'
    }
    return 'Subscribe Now'
  }, [isTrialEnabled])

  const handleSubscribe = async () => {
    try {
      setIsPurchasing(true)

      if (!selectedPackage) {
        Alert.alert('Error', 'Please select a subscription plan.')
        return
      }

      const updatedCustomerInfo = await purchasePackage(selectedPackage.identifier)

      // Verify the Pro entitlement was actually granted
      const hasProEntitlement = Boolean(
        updatedCustomerInfo?.entitlements.active['Pro'],
      )

      if (hasProEntitlement) {
        // Purchase successful and entitlement verified - close the paywall
        Alert.alert(
          'Success!',
          'Your subscription is now active. Enjoy all premium features!',
          [{ text: 'OK', onPress: onClose }],
        )
      } else {
        // Purchase succeeded but entitlement not granted - this is rare but possible
        Alert.alert(
          'Subscription Pending',
          "Your purchase was successful, but it may take a moment to activate. Please restart the app if you still don't have access.",
          [{ text: 'OK' }],
        )
      }
    } catch (error: any) {
      // Handle user cancellation
      if (error?.userCancelled) {
        return
      }

      Alert.alert(
        'Purchase Failed',
        error?.message || 'Unable to complete purchase. Please try again.',
        [{ text: 'OK' }],
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
      const hasProEntitlement = Boolean(
        restoredCustomerInfo?.entitlements.active['Pro'],
      )

      if (hasProEntitlement) {
        Alert.alert('Success!', 'Your purchases have been restored.', [
          { text: 'OK', onPress: onClose },
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Hero Image Section */}
        <View style={styles.heroImageContainer}>
          <Image
            source={getHeroImage()}
            style={styles.heroImage}
            contentFit="cover"
          />

          {/* Top Buttons Overlay */}
          <View style={[styles.headerOverlay, { top: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={onClose}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isRestoring || isPurchasing}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.restoreButtonText}>Restore</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.whiteSection}>
          {/* Title */}
          <View style={styles.heroSection}>
            <Animated.Text entering={FadeInDown.delay(200)} style={styles.heroTitle}>
              {title}
            </Animated.Text>
          </View>

          {/* Content Body */}
          <View style={styles.bodyContent}>
            {/* Plan Selection Cards */}
            <View style={styles.plansContainer}>
              {plans.map((plan, index) => {
                const isSelected = selectedPlanIndex === index
                const hasBadge = plan.badge

                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={1}
                    onPress={() => setSelectedPlanIndex(index)}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                    ]}
                  >
                    {/* Badge Overlay */}
                    {hasBadge && (
                      <View style={styles.cardBadge}>
                        <Text style={styles.cardBadgeText}>{plan.badge}</Text>
                      </View>
                    )}

                    <View style={styles.cardInner}>
                      <View style={styles.planInfoLeft}>
                        <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                          {plan.label}
                        </Text>
                        {plan.subtitle && (
                          <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                        )}
                      </View>
                      
                      <View style={styles.planPriceRight}>
                        <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                          {plan.price}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Free Trial Toggle */}
            <View style={styles.trialToggleContainer}>
              <Text style={styles.trialToggleText}>Try free for 7-days</Text>
              <View style={styles.switchContainer}>
                <Switch
                  value={isTrialEnabled}
                  onValueChange={setIsTrialEnabled}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.backgroundWhite}
                  ios_backgroundColor={colors.border}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.mainButton}
              onPress={handleSubscribe}
              disabled={isPurchasing || isRestoring || !selectedPackage}
              activeOpacity={0.8}
            >
              {isPurchasing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.mainButtonText}>{buttonText}</Text>
              )}
            </TouchableOpacity>

            {/* Footer text */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerGuaranteeText}>
                {selectedPlanIndex === 1 ? 'Billed annually. ' : 'Billed monthly. '}
                Cancel anytime.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function createStyles(colors: any, screenHeight: number = 800) {
  const { width, height } = Dimensions.get('window')

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundWhite,
    },
    heroImageContainer: {
      width: '100%',
      height: height * 0.4,
      backgroundColor: colors.backgroundWhite,
      position: 'relative',
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    headerOverlay: {
      position: 'absolute',
      top: 50,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      alignItems: 'center',
      zIndex: 10,
    },
    headerIconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.backgroundWhite,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    restoreButton: {
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 22,
    },
    restoreButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    whiteSection: {
      flex: 1,
      backgroundColor: colors.backgroundWhite,
    },
    heroSection: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 24,
    },
    heroTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 38,
      letterSpacing: -0.5,
    },
    bodyContent: {
      paddingHorizontal: 20,
      paddingBottom: 34,
      flex: 1,
    },
    plansContainer: {
      flexDirection: 'column',
      justifyContent: 'center',
      marginBottom: 24,
      gap: 12,
    },
    planCard: {
      width: '100%',
      backgroundColor: colors.backgroundWhite,
      borderRadius: 18,
      height: 74,
      borderWidth: 2,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
      position: 'relative',
    },
    planCardSelected: {
      height: 82,
      borderColor: colors.primary,
      backgroundColor: colors.backgroundWhite,
    },
    cardInner: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    planInfoLeft: {
      flex: 1,
      justifyContent: 'center',
    },
    planPriceRight: {
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    cardBadge: {
      position: 'absolute',
      top: -12,
      right: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      zIndex: 10,
      backgroundColor: colors.primary,
    },
    cardBadgeText: {
      color: colors.backgroundWhite,
      fontSize: 12,
      fontWeight: '700',
    },
    planLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    planLabelSelected: {
      color: colors.text,
      fontWeight: '700',
    },
    planPrice: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    planPriceSelected: {
      color: colors.text,
      fontWeight: '700',
    },
    planSubtitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textTertiary,
    },
    trialToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.backgroundWhite,
      borderRadius: 20,
      paddingHorizontal: 20,
      height: 56,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    trialToggleText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    switchContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainButton: {
      width: '100%',
      height: 64,
      backgroundColor: colors.text,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    mainButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.background,
      letterSpacing: 0.3,
    },
    footerContainer: {
      alignItems: 'center',
      marginTop: 16,
    },
    footerGuaranteeText: {
      textAlign: 'center',
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '500',
    },
  })
}
