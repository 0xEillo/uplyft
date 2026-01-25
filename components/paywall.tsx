import { AnalyticsEvents } from '@/constants/analytics-events'
import { AppColors } from '@/constants/colors'
import { useAnalytics } from '@/contexts/analytics-context'
import { useSubscription } from '@/contexts/subscription-context'
import { registerForPushNotifications } from '@/hooks/usePushNotifications'
import { useRevenueCatPackages } from '@/hooks/useRevenueCatPackages'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// AsyncStorage key for trial reminder preference
export const TRIAL_REMINDER_ENABLED_KEY = '@trial_reminder_enabled'

type PaywallProps = {
  visible: boolean
  onClose: () => void
  title?: string
  message?: string
  allowClose?: boolean
}

export function Paywall({
  visible,
  onClose,
  title = 'Unlock your full potential',
  message = 'Get full access to all premium features',
  allowClose = true,
}: PaywallProps) {
  const colors = AppColors
  const insets = useSafeAreaInsets()
  const { height: screenHeight } = useWindowDimensions()
  const styles = createStyles(colors, screenHeight)

  const { trackEvent } = useAnalytics()
  const { purchasePackage, restorePurchases, offerings } = useSubscription()

  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(1) // Default to Yearly
  const [isReminderEnabled, setIsReminderEnabled] = useState(false) // Reminder toggle for notifications

  const {
    monthly: monthlyPackage,
    yearly: yearlyPackage,
  } = useRevenueCatPackages(offerings)

  // Track paywall shown when modal becomes visible
  useEffect(() => {
    if (visible) {
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        source_screen: 'paywall',
        default_plan: 'yearly',
      })
    }
  }, [visible, trackEvent])

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

  // Button text - always show "Start Free Trial" since trial is default
  const buttonText = 'Try 7 days free'

  const handleReminderToggle = async (value: boolean) => {
    if (value) {
      // User wants a reminder - request notification permissions and store preference
      setIsReminderEnabled(true)
      await AsyncStorage.setItem(TRIAL_REMINDER_ENABLED_KEY, '1')
      await registerForPushNotifications()
    } else {
      setIsReminderEnabled(false)
      await AsyncStorage.removeItem(TRIAL_REMINDER_ENABLED_KEY)
    }
  }

  const handleSubscribe = async () => {
    try {
      setIsPurchasing(true)

      if (!selectedPackage) {
        Alert.alert('Error', 'Please select a subscription plan.')
        return
      }

      trackEvent(AnalyticsEvents.SUBSCRIPTION_STARTED, {
        plan_type: plans[selectedPlanIndex].type,
        product_id: selectedPackage.identifier,
        price_string: selectedPackage.product.priceString,
        price: selectedPackage.product.price,
        currency: selectedPackage.product.currencyCode,
        trial_enabled: true,
        trial_duration_days: 7,
        reminder_enabled: isReminderEnabled,
        source_screen: 'paywall',
        subscription_action: 'started',
      })

      const updatedCustomerInfo = await purchasePackage(
        selectedPackage.identifier,
      )

      // Verify the Pro entitlement was actually granted
      const hasProEntitlement = Boolean(
        updatedCustomerInfo?.entitlements.active['Pro'],
      )

      if (hasProEntitlement) {
        // Purchase successful and entitlement verified - close the paywall
        trackEvent(AnalyticsEvents.SUBSCRIPTION_COMPLETED, {
          plan_type: plans[selectedPlanIndex].type,
          product_id: selectedPackage.identifier,
          price_string: selectedPackage.product.priceString,
          price: selectedPackage.product.price,
          currency: selectedPackage.product.currencyCode,
          trial_enabled: true,
          trial_duration_days: 7,
          reminder_enabled: isReminderEnabled,
          source_screen: 'paywall',
          subscription_action: 'completed',
          entitlement_granted: true,
        })
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
    } catch (error) {
      // Handle user cancellation
      const purchaseError = error as {
        userCancelled?: boolean
        message?: string
      }
      if (purchaseError?.userCancelled) {
        trackEvent(AnalyticsEvents.SUBSCRIPTION_CANCELLED, {
          plan_type: plans[selectedPlanIndex].type,
          product_id: selectedPackage?.identifier,
          price_string: selectedPackage?.product.priceString,
          source_screen: 'paywall',
          subscription_action: 'cancelled',
        })
        return
      }

      trackEvent(AnalyticsEvents.SUBSCRIPTION_FAILED, {
        plan_type: plans[selectedPlanIndex].type,
        product_id: selectedPackage?.identifier,
        price_string: selectedPackage?.product.priceString,
        source_screen: 'paywall',
        subscription_action: 'failed',
        error_message: purchaseError?.message || 'Unknown error',
      })

      Alert.alert(
        'Purchase Failed',
        purchaseError?.message ||
          'Unable to complete purchase. Please try again.',
        [{ text: 'OK' }],
      )
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleRestore = async () => {
    try {
      setIsRestoring(true)
      trackEvent(AnalyticsEvents.SUBSCRIPTION_RESTORED, {
        source_screen: 'paywall',
        subscription_action: 'restored',
        is_restore: true,
      })
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
      onRequestClose={() => {
        if (allowClose) {
          onClose()
        }
      }}
    >
      <StatusBar style="dark" />
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
            {allowClose ? (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={onClose}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isRestoring || isPurchasing}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
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
            <Animated.Text
              entering={FadeInDown.delay(200)}
              style={styles.heroTitle}
            >
              {title}
            </Animated.Text>

            {/* Review Section */}
            <Animated.View 
              entering={FadeInDown.delay(400)}
              style={styles.reviewContainer}
            >
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name="star" size={12} color="#FF9500" />
                ))}
              </View>
              <Text style={styles.reviewText}>
               "Rep AI is the best workout tracker I have tried and the only one I actually stick to."
              </Text>
              <View style={styles.authorContainer}>
                <Text style={styles.reviewAuthor}>Matt J.</Text>
                <Ionicons name="checkmark-circle" size={12} color={colors.textTertiary} style={{ marginLeft: 4 }} />
              </View>
            </Animated.View>
          </View>

          {/* Flex Spacer - pushes bottom content down */}
          <View style={styles.flexSpacer} />

          {/* Bottom Section - All grouped together */}
          <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {/* Reminder Toggle */}
            <View style={styles.trialToggleContainer}>
              <View style={styles.reminderTextContainer}>
                <Text style={styles.trialToggleText}>
                  Remind me before my trial ends
                </Text>
              </View>
              <View style={styles.switchContainer}>
                <Switch
                  value={isReminderEnabled}
                  onValueChange={handleReminderToggle}
                  trackColor={{ false: colors.border, true: colors.textPrimary }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.border}
                />
              </View>
            </View>

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
                        <Text
                          style={[
                            styles.planLabel,
                            isSelected && styles.planLabelSelected,
                          ]}
                        >
                          {plan.label}
                        </Text>
                        {plan.subtitle && (
                          <Text style={styles.planSubtitle}>
                            {plan.subtitle}
                          </Text>
                        )}
                      </View>

                      <View style={styles.planPriceRight}>
                        <Text
                          style={[
                            styles.planPrice,
                            isSelected && styles.planPriceSelected,
                          ]}
                        >
                          {plan.price}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.mainButton}
              onPress={handleSubscribe}
              disabled={isPurchasing || isRestoring || !selectedPackage}
              activeOpacity={0.8}
            >
              {isPurchasing ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.mainButtonText}>{buttonText}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.noPaymentContainer}>
              <Ionicons name="checkmark" size={16} color={colors.textSecondary} />
              <Text style={styles.noPaymentText}>No payment due now</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function createStyles(colors: typeof AppColors, screenHeight: number) {
  // Responsive scaling based on screen height
  // Small: iPhone SE, iPhone 12/13/14 mini (~667-740px)
  // Medium: iPhone 12/13/14/15 standard (~844-852px)
  // Large: iPhone Pro Max, Plus models (~926px+)
  const isSmallScreen = screenHeight < 750
  const isMediumScreen = screenHeight >= 750 && screenHeight < 900
  const isLargeScreen = screenHeight >= 900

  // Dynamic hero image height - balanced for all screens
  // This gives a good proportion while leaving room for bottom content
  const heroImageHeight = isSmallScreen 
    ? screenHeight * 0.34 
    : isMediumScreen 
      ? screenHeight * 0.40 
      : screenHeight * 0.42

  // Dynamic spacing
  const heroSectionPaddingTop = isSmallScreen ? 12 : isMediumScreen ? 16 : 24
  const heroSectionPaddingBottom = isSmallScreen ? 8 : isMediumScreen ? 12 : 20
  const reviewMarginTop = isSmallScreen ? 6 : isMediumScreen ? 10 : 14

  // Dynamic font sizes
  const heroTitleSize = isSmallScreen ? 24 : isMediumScreen ? 26 : 30
  const heroTitleLineHeight = isSmallScreen ? 30 : isMediumScreen ? 32 : 38
  const reviewTextSize = isSmallScreen ? 13 : isMediumScreen ? 13 : 15
  const reviewTextLineHeight = isSmallScreen ? 18 : isMediumScreen ? 19 : 22

  // Dynamic card heights
  const planCardHeight = isSmallScreen ? 52 : isMediumScreen ? 56 : 64
  const planCardSelectedHeight = isSmallScreen ? 58 : isMediumScreen ? 62 : 72
  const toggleHeight = isSmallScreen ? 42 : isMediumScreen ? 46 : 50
  const mainButtonHeight = isSmallScreen ? 46 : isMediumScreen ? 50 : 54

  // Dynamic gaps
  const planGap = isSmallScreen ? 6 : isMediumScreen ? 8 : 10
  const bottomMargin = isSmallScreen ? 8 : isMediumScreen ? 10 : 14

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    heroImageContainer: {
      width: '100%',
      height: heroImageHeight,
      backgroundColor: colors.surface,
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
      width: isSmallScreen ? 38 : 44,
      height: isSmallScreen ? 38 : 44,
      borderRadius: isSmallScreen ? 19 : 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    restoreButton: {
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: isSmallScreen ? 14 : 20,
      paddingVertical: isSmallScreen ? 8 : 10,
      borderRadius: isSmallScreen ? 18 : 22,
    },
    restoreButtonText: {
      fontSize: isSmallScreen ? 13 : 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    whiteSection: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    heroSection: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isSmallScreen ? 16 : 24,
      paddingTop: heroSectionPaddingTop,
      paddingBottom: heroSectionPaddingBottom,
    },
    heroTitle: {
      fontSize: heroTitleSize,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      lineHeight: heroTitleLineHeight,
      letterSpacing: -0.5,
      marginBottom: isSmallScreen ? 4 : 8,
    },
    reviewContainer: {
      alignItems: 'center',
      marginTop: reviewMarginTop,
      paddingHorizontal: isSmallScreen ? 4 : 8,
    },
    starsContainer: {
      flexDirection: 'row',
      gap: isSmallScreen ? 3 : 4,
      marginBottom: isSmallScreen ? 8 : 12,
    },
    reviewText: {
      fontSize: reviewTextSize,
      lineHeight: reviewTextLineHeight,
      color: colors.textSecondary,
      textAlign: 'center',
      marginHorizontal: isSmallScreen ? 4 : 10,
    },
    reviewAuthor: {
      fontSize: isSmallScreen ? 12 : 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    authorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: isSmallScreen ? 6 : 8,
    },
    verifiedText: {
      fontSize: 12,
      color: colors.textTertiary,
      marginLeft: 2,
    },
    reviewDots: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 16,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      opacity: 0.3,
    },
    dotActive: {
      backgroundColor: colors.textPrimary,
      opacity: 1,
    },
    flexSpacer: {
      flex: 1,
      minHeight: isSmallScreen ? 8 : 16,
    },
    bottomSection: {
      paddingHorizontal: isSmallScreen ? 16 : 20,
    },
    plansContainer: {
      flexDirection: 'column',
      justifyContent: 'center',
      marginBottom: bottomMargin,
      gap: planGap,
    },
    planCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: isSmallScreen ? 12 : 16,
      height: planCardHeight,
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
      height: planCardSelectedHeight,
      borderColor: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    cardInner: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? 14 : 18,
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
      top: isSmallScreen ? -9 : -11,
      right: isSmallScreen ? 12 : 18,
      paddingHorizontal: isSmallScreen ? 8 : 10,
      paddingVertical: isSmallScreen ? 4 : 5,
      borderRadius: isSmallScreen ? 10 : 14,
      zIndex: 10,
      backgroundColor: colors.textPrimary,
    },
    cardBadgeText: {
      color: colors.surface,
      fontSize: isSmallScreen ? 10 : 11,
      fontWeight: '700',
    },
    planLabel: {
      fontSize: isSmallScreen ? 15 : 17,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    planLabelSelected: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    planPrice: {
      fontSize: isSmallScreen ? 15 : 17,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    planPriceSelected: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    planSubtitle: {
      fontSize: isSmallScreen ? 11 : 13,
      fontWeight: '500',
      color: colors.textTertiary,
    },
    trialToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: isSmallScreen ? 14 : 18,
      paddingHorizontal: isSmallScreen ? 14 : 18,
      height: toggleHeight,
      marginBottom: bottomMargin,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    trialToggleText: {
      fontSize: isSmallScreen ? 13 : 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    reminderTextContainer: {
      flex: 1,
      paddingRight: isSmallScreen ? 8 : 12,
    },
    switchContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainButton: {
      width: '100%',
      height: mainButtonHeight,
      backgroundColor: colors.textPrimary,
      borderRadius: mainButtonHeight / 2,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    mainButtonText: {
      fontSize: isSmallScreen ? 15 : 17,
      fontWeight: '700',
      color: colors.bg,
      letterSpacing: 0.3,
    },
    noPaymentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: isSmallScreen ? 8 : 12,
      gap: 4,
    },
    noPaymentText: {
      fontSize: isSmallScreen ? 12 : 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  })
}
