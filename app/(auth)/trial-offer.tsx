import { AnalyticsEvents } from '@/constants/analytics-events'
import { ProBadge } from '@/components/pro-badge'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
import { useSubscription } from '@/contexts/subscription-context'
import {
  calculateYearlySavings,
  useRevenueCatPackages,
} from '@/hooks/useRevenueCatPackages'
import { useThemedColors } from '@/hooks/useThemedColors'
import { scheduleTrialExpirationNotification } from '@/lib/services/notification-service'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PACKAGE_TYPE } from 'react-native-purchases'

// Animated TouchableOpacity with press animation
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

// Animated Button with scale press effect
function AnimatedButton({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress: () => void
  disabled?: boolean
  style: any
  children: React.ReactNode
}) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.96, { damping: 15, stiffness: 400 })
    }
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 })
  }

  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.9}
    >
      {children}
    </AnimatedTouchable>
  )
}

export default function TrialOfferScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const screenHeight = Dimensions.get('window').height
  const styles = createStyles(colors, screenHeight)
  const { trackEvent } = useAnalytics()
  const [step, setStep] = useState(1)
  const [isPurchasing, setIsPurchasing] = useState(false)

  const { user } = useAuth()
  const {
    offerings,
    purchasePackage,
    isLoading: subscriptionLoading,
  } = useSubscription()
  const { requestPermission, hasPermission } = useNotifications()

  const { monthly: monthlyPackage, yearly: yearlyPackage } =
    useRevenueCatPackages(offerings)

  const yearlySavings = useMemo(
    () => calculateYearlySavings(monthlyPackage, yearlyPackage),
    [monthlyPackage, yearlyPackage],
  )

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>(
    'monthly',
  )

  useEffect(() => {
    if (selectedPlan === 'monthly' && !monthlyPackage && yearlyPackage) {
      setSelectedPlan('yearly')
    } else if (selectedPlan === 'yearly' && !yearlyPackage && monthlyPackage) {
      setSelectedPlan('monthly')
    }
  }, [monthlyPackage, selectedPlan, yearlyPackage])

  const selectedTrialPackage = useMemo(() => {
    if (selectedPlan === 'yearly') {
      return yearlyPackage ?? monthlyPackage ?? null
    }

    return monthlyPackage ?? yearlyPackage ?? null
  }, [monthlyPackage, selectedPlan, yearlyPackage])

  const trialPriceText = useMemo(() => {
    if (!selectedTrialPackage) {
      return 'Select a plan to see pricing'
    }
    if (selectedTrialPackage.packageType === PACKAGE_TYPE.ANNUAL) {
      return `${selectedTrialPackage.product.priceString} per year`
    }
    return `${selectedTrialPackage.product.priceString} per month`
  }, [selectedTrialPackage])

  // Track trial offer view on mount
  useEffect(() => {
    trackEvent(AnalyticsEvents.TRIAL_OFFER_VIEWED, {})
  }, [trackEvent])

  // Track trial offer step views
  useEffect(() => {
    const stepNames: {
      [key: number]: 'intro' | 'benefits' | 'payment_setup'
    } = {
      1: 'intro',
      2: 'benefits',
      3: 'payment_setup',
    }

    trackEvent(AnalyticsEvents.TRIAL_OFFER_STEP_VIEWED, {
      step,
      step_name: stepNames[step],
    })
  }, [step, trackEvent])

  // Check if user came back after logging in (can now make purchases)
  const canPurchase = params.can_purchase === 'true' && user

  const handleStartTrial = async () => {
    // If user is logged in and can purchase, process the purchase
    if (canPurchase) {
      try {
        setIsPurchasing(true)

        trackEvent(AnalyticsEvents.TRIAL_OFFER_STEP_COMPLETED, {
          step: 3,
          step_name: 'payment_setup',
        })

        let targetPackage = selectedTrialPackage
        if (!targetPackage) {
          const fallback = offerings?.availablePackages?.[0]
          if (!fallback) {
            throw new Error(
              'No subscription packages available. Please try again.',
            )
          }
          targetPackage = fallback
        }

        const updatedCustomerInfo = await purchasePackage(
          targetPackage.identifier,
        )

        // Verify the Pro entitlement was actually granted
        const hasProEntitlement = Boolean(
          updatedCustomerInfo?.entitlements.active['Pro'],
        )

        if (!hasProEntitlement) {
          Alert.alert(
            'Subscription Pending',
            "Your purchase was successful, but it may take a moment to activate. Please restart the app if you still don't have access.",
            [{ text: 'OK' }],
          )
        }

        // Schedule trial expiration notification
        try {
          if (!hasPermission) {
            await requestPermission()
          }
          const trialStartDate = new Date()
          await scheduleTrialExpirationNotification(user.id, trialStartDate)
        } catch (notificationError) {
          console.error(
            '[TrialOffer] Failed to schedule notification:',
            notificationError,
          )
        }

        trackEvent(AnalyticsEvents.TRIAL_OFFER_ACCEPTED, {})
        router.replace('/(tabs)')
      } catch (error) {
        const errorObj = error as any
        if (errorObj?.userCancelled) {
          return
        }
        console.error('[TrialOffer] Purchase error:', error)
        Alert.alert(
          'Unable to Start Trial',
          errorObj?.message ||
            'There was a problem starting your trial. Please try again.',
          [{ text: 'OK' }],
        )
      } finally {
        setIsPurchasing(false)
      }
    } else {
      // User isn't logged in yet during onboarding, navigate to signup
      trackEvent(AnalyticsEvents.TRIAL_OFFER_STEP_COMPLETED, {
        step: 3,
        step_name: 'payment_setup',
      })
      trackEvent(AnalyticsEvents.TRIAL_OFFER_ACCEPTED, {})

      router.push({
        pathname: '/(auth)/signup-options',
        params: {
          onboarding_data: params.onboarding_data as string | undefined,
          start_trial: 'true',
        },
      })
    }
  }

  const handleSkipTrial = () => {
    // Track that user skipped the trial
    trackEvent(AnalyticsEvents.TRIAL_OFFER_SKIPPED, {})

    // If user is already logged in, go to app; otherwise go to signup
    if (canPurchase) {
      router.replace('/(tabs)')
    } else {
      router.push({
        pathname: '/(auth)/signup-options',
        params: {
          onboarding_data: params.onboarding_data as string | undefined,
        },
      })
    }
  }

  const renderStep1 = () => (
    <>
      {/* Header */}
      <View style={styles.step1HeaderContainer}>
        <View style={styles.step1HeaderSpacer} />
        <View style={styles.step1HeaderSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.step1ScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View
          style={styles.step1TitleContainer}
          entering={FadeInDown.delay(100).duration(600)}
        >
          <Text style={styles.step1Title}>Try </Text>
          <ProBadge size="large" />
          <Text style={styles.step1Title}> for FREE</Text>
        </Animated.View>

        {/* Features */}
        <View style={styles.step1FeaturesContainer}>
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <Feature
              icon="infinite"
              title="Unlimited Workouts"
              description="Log as many workouts as you want"
              colors={colors}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(280).duration(600)}>
            <Feature
              icon="analytics"
              title="AI-Powered Chat"
              description="AI assistant with all your workout data"
              colors={colors}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(360).duration(600)}>
            <Feature
              icon="body"
              title="Body Scan"
              description="Track your physique with body analysis"
              colors={colors}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(440).duration(600)}>
            <Feature
              icon="trending-up"
              title="Track Your Progress"
              description="View detailed stats and records"
              colors={colors}
            />
          </Animated.View>
        </View>
      </ScrollView>

      {/* Button */}
      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(520).duration(600)}
      >
        {/* No Payment Due */}
        <View style={styles.noPaymentContainer}>
          <Ionicons name="checkmark" size={24} color={colors.text} />
          <Text style={styles.noPaymentText}>No Payment Due Now</Text>
        </View>

        <AnimatedButton
          style={styles.startButton}
          onPress={() => {
            trackEvent(AnalyticsEvents.TRIAL_OFFER_STEP_COMPLETED, {
              step: 1,
              step_name: 'intro',
            })
            setStep(2)
          }}
        >
          <Text style={styles.startButtonText}>Try for FREE</Text>
        </AnimatedButton>

        {/* Skip Button */}
        <AnimatedButton style={styles.skipButton} onPress={handleSkipTrial}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </AnimatedButton>

        {/* Terms of Service Link */}
        <TouchableOpacity onPress={handleOpenTerms} style={styles.termsLink}>
          <Text style={styles.termsText}>Terms of Service</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  )

  const handleStep2Continue = async () => {
    // Request notification permission before moving to step 3
    try {
      await requestPermission()
      trackEvent(AnalyticsEvents.TRIAL_OFFER_STEP_COMPLETED, {
        step: 2,
        step_name: 'benefits',
      })
      setStep(3)
    } catch (error) {
      console.error(
        '[TrialOffer] Error requesting notification permission:',
        error,
      )
      // Still continue even if permission request fails
      trackEvent(AnalyticsEvents.TRIAL_OFFER_STEP_COMPLETED, {
        step: 2,
        step_name: 'benefits',
      })
      setStep(3)
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
      console.error('[TrialOffer] Failed to open terms:', error)
    }
  }

  const renderStep2 = () => (
    <>
      {/* Header with Back Button */}
      <View style={styles.step2HeaderContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            trackEvent(AnalyticsEvents.TRIAL_OFFER_DISMISSED, {})
            setStep(1)
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.step1HeaderSpacer} />
      </View>

      <View style={styles.centeredContent}>
        {/* Bell Icon */}
        <Animated.View
          style={styles.bellContainer}
          entering={FadeInDown.delay(100).duration(600)}
        >
          <View style={styles.bellIconWrapper}>
            <Ionicons name="notifications" size={120} color={colors.text} />
            <Animated.View
              style={styles.notificationBadge}
              entering={FadeInDown.delay(300).duration(600)}
            >
              <Text style={styles.notificationBadgeText}>1</Text>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.Text
          style={styles.title}
          entering={FadeInDown.delay(400).duration(600)}
        >
          We&apos;ll send you a reminder before your free trial ends
        </Animated.Text>
      </View>

      {/* Button */}
      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(500).duration(600)}
      >
        {/* No Payment Due */}
        <View style={styles.noPaymentContainer}>
          <Ionicons name="checkmark" size={24} color={colors.text} />
          <Text style={styles.noPaymentText}>No Payment Due Now</Text>
        </View>

        <AnimatedButton
          style={styles.startButton}
          onPress={handleStep2Continue}
        >
          <Text style={styles.startButtonText}>Continue for FREE</Text>
        </AnimatedButton>

        {/* Skip Button */}
        <AnimatedButton style={styles.skipButton} onPress={handleSkipTrial}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </AnimatedButton>

        {/* Terms of Service Link */}
        <TouchableOpacity onPress={handleOpenTerms} style={styles.termsLink}>
          <Text style={styles.termsText}>Terms of Service</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  )

  const renderStep3 = () => {
    const trialEndDate = new Date()
    trialEndDate.setDate(trialEndDate.getDate() + 7)
    const formattedDate = trialEndDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    return (
      <>
        {/* Header with Back Button */}
        <View style={styles.step3HeaderContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              trackEvent(AnalyticsEvents.TRIAL_OFFER_DISMISSED, {})
              setStep(2)
            }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.step1HeaderSpacer} />
        </View>

        <View style={styles.step3ContentWrapper}>
          <ScrollView
            contentContainerStyle={styles.step3ScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Animated.Text
              style={styles.step3Title}
              entering={FadeInDown.delay(100).duration(600)}
            >
              Start your 7-day FREE trial
            </Animated.Text>

            {/* Timeline */}
            <View style={styles.timelineContainer}>
              <Animated.View entering={FadeInDown.delay(200).duration(600)}>
                <TimelineItem
                  icon="lock-open"
                  iconColor={colors.primary}
                  title="Today"
                  description="Unlock all the app's features like AI calorie scanning and more."
                  colors={colors}
                  isActive
                />
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(300).duration(600)}>
                <TimelineItem
                  icon="notifications"
                  iconColor={colors.primary}
                  title="In 6 Days - Reminder"
                  description="We'll send you a reminder that your trial is ending soon."
                  colors={colors}
                />
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(400).duration(600)}>
                <TimelineItem
                  icon="card"
                  iconColor={colors.buttonText}
                  title="In 7 Days - Billing Starts"
                  description={`You'll be charged on ${formattedDate} unless you cancel anytime before.`}
                  colors={colors}
                  isLast
                />
              </Animated.View>
            </View>

            {(monthlyPackage || yearlyPackage) && (
              <View style={styles.pricingCardsContainer}>
                {monthlyPackage && (
                  <TouchableOpacity
                    style={[
                      styles.pricingOption,
                      selectedPlan === 'monthly' && styles.pricingOptionSelected,
                    ]}
                    onPress={() => setSelectedPlan('monthly')}
                    activeOpacity={0.9}
                  >
                    <View style={styles.pricingOptionContent}>
                      <Text style={styles.pricingOptionLabel}>Monthly</Text>
                      <Text style={styles.pricingOptionPrice}>
                        {monthlyPackage.product.priceString}
                      </Text>
                      <Text style={styles.pricingOptionSubtext}>
                        Billed monthly
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioButton,
                        selectedPlan === 'monthly' && styles.radioButtonSelected,
                      ]}
                    >
                      {selectedPlan === 'monthly' && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                )}

                {yearlyPackage && (
                  <TouchableOpacity
                    style={[
                      styles.pricingOption,
                      selectedPlan === 'yearly' && styles.pricingOptionSelected,
                    ]}
                    onPress={() => setSelectedPlan('yearly')}
                    activeOpacity={0.9}
                  >
                    {yearlySavings ? (
                      <View style={styles.freeBadge}>
                        <Text style={styles.freeBadgeText}>
                          SAVE {yearlySavings}%
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.pricingOptionContent}>
                      <Text style={styles.pricingOptionLabel}>Yearly</Text>
                      <Text style={styles.pricingOptionPrice}>
                        {yearlyPackage.product.priceString}
                      </Text>
                      <Text style={styles.pricingOptionSubtext}>
                        Billed annually
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioButton,
                        selectedPlan === 'yearly' && styles.radioButtonSelected,
                      ]}
                    >
                      {selectedPlan === 'yearly' && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>

        {/* Button */}
        <Animated.View
          style={styles.footer}
          entering={FadeInDown.delay(600).duration(600)}
        >
          {/* No Payment Due */}
          <View style={styles.noPaymentContainer}>
            <Ionicons name="checkmark" size={24} color={colors.text} />
            <Text style={styles.noPaymentText}>No Payment Due Now</Text>
          </View>

          <AnimatedButton
            style={styles.startButton}
            onPress={handleStartTrial}
            disabled={isPurchasing || subscriptionLoading}
          >
            {isPurchasing ? (
              <>
                <ActivityIndicator color={colors.buttonText} size="small" />
                <Text style={styles.startButtonText}>Starting Trial...</Text>
              </>
            ) : (
              <Text style={styles.startButtonText}>
                Start My 7-Day Free Trial
              </Text>
            )}
          </AnimatedButton>
          <Text style={styles.footerSubtext}>
            7 days free, then {trialPriceText}
          </Text>

          {/* Skip Button */}
          <AnimatedButton
            style={styles.skipButton}
            onPress={handleSkipTrial}
            disabled={isPurchasing || subscriptionLoading}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </AnimatedButton>

          {/* Terms of Service Link */}
          <TouchableOpacity onPress={handleOpenTerms} style={styles.termsLink}>
            <Text style={styles.termsText}>Terms of Service</Text>
          </TouchableOpacity>
        </Animated.View>
      </>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </SafeAreaView>
  )
}

function Feature({
  icon,
  title,
  description,
  colors,
}: {
  icon: any
  title: string
  description: string
  colors: any
}) {
  const styles = createStyles(colors)

  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  )
}

function TimelineItem({
  icon,
  iconColor,
  title,
  description,
  colors,
  isActive,
  isLast,
}: {
  icon: any
  iconColor: string
  title: string
  description: string
  colors: any
  isActive?: boolean
  isLast?: boolean
}) {
  const styles = createStyles(colors)

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineIconContainer}>
        <View
          style={[
            styles.timelineIcon,
            {
              backgroundColor: isActive
                ? colors.primary
                : isLast
                ? colors.textSecondary
                : colors.primary,
            },
          ]}
        >
          <Ionicons name={icon} size={24} color={colors.buttonText} />
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineDescription}>{description}</Text>
      </View>
    </View>
  )
}

function createStyles(colors: any, screenHeight: number = 800) {
  // Calculate dynamic spacing based on screen height
  // Use ~12% of screen height for title margin, but cap between 64-120px
  const titleMarginBottom = Math.max(64, Math.min(120, screenHeight * 0.12))

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    backButtonContainer: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 8,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    step1HeaderContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 8,
    },
    step1HeaderSpacer: {
      width: 40,
    },
    step2HeaderContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 8,
    },
    step3HeaderContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 20,
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 16,
    },
    // Step 1 specific styles
    step1ScrollContent: {
      paddingHorizontal: 32,
      paddingTop: 32,
      paddingBottom: 24,
      flexGrow: 1,
      justifyContent: 'center',
    },
    step1TitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 64,
      paddingHorizontal: 8,
      flexWrap: 'wrap',
    },
    step1Title: {
      fontSize: 34,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 40,
    },
    step1FeaturesContainer: {
      gap: 24,
      paddingTop: 8,
    },
    // Step 3 specific styles
    step3ContentWrapper: {
      flex: 1,
    },
    step3ScrollContent: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 20,
      flexGrow: 1,
      justifyContent: 'center',
    },
    step3Title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      paddingHorizontal: 16,
      lineHeight: 32,
      marginTop: 8,
      marginBottom: titleMarginBottom,
    },
    step3PricingSection: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 16,
    },
    centeredContent: {
      flex: 1,
      paddingHorizontal: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    featuresContainer: {
      marginBottom: 32,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    featureIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    // Step 2 Styles
    bellContainer: {
      marginBottom: 40,
      alignItems: 'center',
    },
    bellIconWrapper: {
      position: 'relative',
    },
    notificationBadge: {
      position: 'absolute',
      top: 15,
      right: 15,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationBadgeText: {
      color: colors.buttonText,
      fontSize: 24,
      fontWeight: '700',
    },
    noPaymentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 6,
    },
    noPaymentText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    // Step 3 Timeline Styles
    timelineContainer: {
      paddingHorizontal: 8,
      paddingTop: 0,
      marginBottom: 24,
    },
    timelineItem: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    timelineIconContainer: {
      alignItems: 'center',
      marginRight: 16,
    },
    timelineIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timelineLine: {
      width: 3,
      flex: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    timelineContent: {
      flex: 1,
      paddingTop: 6,
      paddingBottom: 18,
    },
    timelineTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    timelineDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    // Pricing Cards
    pricingCardsContainer: {
      gap: 16,
      marginBottom: 24,
      marginTop: 8,
    },
    pricingOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
      position: 'relative',
      gap: 12,
    },
    pricingOptionYearly: {
      position: 'relative',
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    pricingOptionSelected: {
      borderColor: colors.primary,
    },
    pricingOptionContent: {
      flex: 1,
    },
    pricingOptionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    pricingOptionPrice: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    pricingOptionSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    radioButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    radioButtonInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.text,
    },
    freeBadge: {
      position: 'absolute',
      top: -10,
      right: 16,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 16,
      zIndex: 10,
    },
    freeBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.buttonText,
    },
    pricingCard: {
      backgroundColor: colors.white,
      padding: 24,
      borderRadius: 16,
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    pricingTitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    pricingPrice: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    pricingSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    terms: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 16,
    },
    footer: {
      paddingHorizontal: 24,
      paddingTop: 4,
      paddingBottom: 24,
      gap: 8,
    },
    footerSubtext: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
    },
    startButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 28,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    startButtonText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
    skipButton: {
      height: 56,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    skipButtonText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    termsLink: {
      marginTop: 4,
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
