import { useThemedColors } from '@/hooks/useThemedColors'
import { useNotifications } from '@/contexts/notification-context'
import { useAuth } from '@/contexts/auth-context'
import { scheduleTrialExpirationNotification } from '@/lib/services/notification-service'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { useSubscription } from '@/contexts/subscription-context'

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
  const styles = createStyles(colors)
  const [step, setStep] = useState(1)
  const [isPurchasing, setIsPurchasing] = useState(false)

  const { user } = useAuth()
  const { offerings, purchasePackage, isLoading: subscriptionLoading } = useSubscription()
  const { requestPermission, hasPermission } = useNotifications()

  const handleStartTrial = async () => {
    try {
      setIsPurchasing(true)

      // Get the monthly package (should have the 7-day trial)
      if (!offerings) {
        throw new Error('No subscription packages available. Please try again.')
      }

      // Find the monthly package - RevenueCat typically uses $rc_monthly identifier
      const monthlyPackage = offerings.availablePackages.find(
        (pkg) => pkg.identifier === '$rc_monthly' || pkg.identifier.toLowerCase().includes('monthly')
      )

      if (!monthlyPackage) {
        // If no monthly package found, try the first available package
        const firstPackage = offerings.availablePackages[0]
        if (!firstPackage) {
          throw new Error('No subscription packages available. Please try again.')
        }
        console.log('[TrialOffer] Using first available package:', firstPackage.identifier)
        await purchasePackage(firstPackage.identifier)
      } else {
        console.log('[TrialOffer] Starting trial with package:', monthlyPackage.identifier)
        await purchasePackage(monthlyPackage.identifier)
      }

      // Purchase successful
      console.log('[TrialOffer] Trial started successfully')

      // Request notification permission and schedule trial expiration notification
      if (user) {
        try {
          // Request permission if not already granted
          if (!hasPermission) {
            await requestPermission()
          }

          // Schedule the trial expiration notification
          const trialStartDate = new Date()
          await scheduleTrialExpirationNotification(user.id, trialStartDate)
          console.log('[TrialOffer] Trial expiration notification scheduled')
        } catch (notificationError) {
          // Don't block the flow if notification fails
          console.error('[TrialOffer] Failed to schedule notification:', notificationError)
        }
      }

      // Navigate to signup
      router.push({
        pathname: '/(auth)/signup-options',
        params: {
          onboarding_data: params.onboarding_data as string,
        },
      })
    } catch (error: any) {
      console.error('[TrialOffer] Purchase error:', error)

      // Handle user cancellation (not an error)
      if (error?.userCancelled) {
        console.log('[TrialOffer] User cancelled purchase')
        return
      }

      // Show error to user
      Alert.alert(
        'Unable to Start Trial',
        error?.message || 'There was a problem starting your trial. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setIsPurchasing(false)
    }
  }

  const renderStep1 = () => (
    <>
      <ScrollView
        contentContainerStyle={styles.step1ScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Icon */}
        <Animated.View
          style={styles.step1IconContainer}
          entering={FadeInDown.delay(100).duration(600)}
        >
          <Ionicons name="barbell" size={80} color={colors.primary} />
        </Animated.View>

        {/* Title */}
        <Animated.Text
          style={styles.step1Title}
          entering={FadeInDown.delay(200).duration(600)}
        >
          We want you to try Rep AI for FREE.
        </Animated.Text>

        {/* Features */}
        <View style={styles.step1FeaturesContainer}>
          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <Feature
              icon="infinite"
              title="Unlimited Workouts"
              description="Log as many workouts as you want"
              colors={colors}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(380).duration(600)}>
            <Feature
              icon="analytics"
              title="AI-Powered Chat"
              description="AI assistant with all your workout data"
              colors={colors}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(460).duration(600)}>
            <Feature
              icon="trending-up"
              title="Track Your PRs"
              description="Celebrate every personal record"
              colors={colors}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(540).duration(600)}>
            <Feature
              icon="mic"
              title="Voice Logging"
              description="Log workouts faster with your voice"
              colors={colors}
            />
          </Animated.View>
        </View>
      </ScrollView>

      {/* Button */}
      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(620).duration(600)}
      >
        {/* No Payment Due */}
        <View style={styles.noPaymentContainer}>
          <Ionicons name="checkmark" size={24} color={colors.text} />
          <Text style={styles.noPaymentText}>No Payment Due Now</Text>
        </View>

        <AnimatedButton style={styles.startButton} onPress={() => setStep(2)}>
          <Text style={styles.startButtonText}>Try for FREE</Text>
        </AnimatedButton>
      </Animated.View>
    </>
  )

  const renderStep2 = () => (
    <>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.centeredContent}>
        {/* Bell Icon */}
        <Animated.View
          style={styles.bellContainer}
          entering={FadeInDown.delay(100).duration(600)}
        >
          <View style={styles.bellIconWrapper}>
            <Ionicons name="notifications" size={120} color={colors.border} />
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
          We'll send you a reminder before your free trial ends
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

        <AnimatedButton style={styles.startButton} onPress={() => setStep(3)}>
          <Text style={styles.startButtonText}>Continue for FREE</Text>
        </AnimatedButton>
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
        {/* Back Button */}
        <View style={styles.backButtonContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(2)}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
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
              Start your 7-day FREE trial to continue.
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
          </ScrollView>

          {/* Pricing Section - Fixed at bottom */}
          <Animated.View
            style={styles.step3PricingSection}
            entering={FadeInDown.delay(500).duration(600)}
          >
            {/* Pricing Card */}
            <View style={styles.pricingCardsContainer}>
              <View
                style={[styles.pricingOption, styles.pricingOptionSelected]}
              >
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>7 DAYS FREE</Text>
                </View>
                <View style={styles.pricingOptionContent}>
                  <Text style={styles.pricingOptionLabel}>Monthly</Text>
                  <Text style={styles.pricingOptionPrice}>$5.99 /mo</Text>
                </View>
                <View style={[styles.radioButton, styles.radioButtonSelected]}>
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.buttonText}
                  />
                </View>
              </View>
            </View>
          </Animated.View>
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
                <Text style={styles.startButtonText}>
                  Starting Trial...
                </Text>
              </>
            ) : (
              <Text style={styles.startButtonText}>
                Start My 7-Day Free Trial
              </Text>
            )}
          </AnimatedButton>
          <Text style={styles.footerSubtext}>
            7 days free, then $5.99 per month
          </Text>
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

function createStyles(colors: any) {
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
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 16,
    },
    // Step 1 specific styles
    step1ScrollContent: {
      paddingHorizontal: 32,
      paddingBottom: 24,
      flexGrow: 1,
      justifyContent: 'center',
    },
    step1IconContainer: {
      alignItems: 'center',
      marginBottom: 32,
    },
    step1Title: {
      fontSize: 34,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 48,
      paddingHorizontal: 8,
      lineHeight: 40,
    },
    step1FeaturesContainer: {
      gap: 24,
    },
    // Step 3 specific styles
    step3ContentWrapper: {
      flex: 1,
    },
    step3ScrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 20,
    },
    step3Title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      paddingHorizontal: 16,
      lineHeight: 32,
      marginBottom: 32,
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
      paddingTop: 24,
      marginBottom: 16,
    },
    timelineItem: {
      flexDirection: 'row',
      marginBottom: 4,
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
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    timelineDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    // Pricing Cards
    pricingCardsContainer: {
      gap: 16,
      marginBottom: 0,
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
      color: colors.textSecondary,
      textAlign: 'center',
    },
    startButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 12,
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
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    skipButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
  })
}
