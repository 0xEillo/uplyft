import { ProBadge } from '@/components/pro-badge'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
import { useSubscription } from '@/contexts/subscription-context'
import {
    calculateYearlySavings,
    useRevenueCatPackages,
} from '@/hooks/useRevenueCatPackages'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { scheduleTrialExpirationNotification } from '@/lib/services/notification-service'
import { supabase } from '@/lib/supabase'
import { Gender, Goal, TrainingYears } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Linking,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { PACKAGE_TYPE } from 'react-native-purchases'
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Circle, Defs, LinearGradient, Path, Stop, Svg } from 'react-native-svg'

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
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
  const styles = createStyles(colors, screenHeight)
  const { trackEvent } = useAnalytics()
  const [step, setStep] = useState(1)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)

  const handleCarouselScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / screenWidth)
    setActiveSlide(slide)
  }

  // Feature items for the carousel (matching paywall)
  const FEATURES = [
    {
      id: 'unlimited_workouts',
      title: 'Unlimited Workouts',
      description: 'Log as many workouts as you want.',
      renderVisual: () => (
        <View style={[styles.visualContainer, { width: screenWidth - 48 }]}>
          <View style={styles.workoutsVisual}>
            {/* Calendar Week View */}
            <View style={styles.calendarWeek}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                <View key={index} style={styles.calendarDay}>
                  <Text style={styles.calendarDayLabel}>{day}</Text>
                  <View
                    style={[
                      styles.calendarDayCircle,
                      index < 5 && styles.calendarDayActive,
                    ]}
                  >
                    {index < 5 && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Workout Cards - Vertically stacked */}
            <View style={styles.workoutCardsList}>
              <View style={styles.workoutListCard}>
                <View style={styles.workoutStackDot} />
                <Text style={styles.workoutStackText}>Leg Day</Text>
                <View style={styles.workoutStackBadge}>
                  <Ionicons name="flame" size={12} color={colors.primary} />
                  <Text style={styles.workoutStackBadgeText}>5</Text>
                </View>
              </View>
              <View
                style={[styles.workoutListCard, styles.workoutListCardFaded]}
              >
                <View style={styles.workoutStackDot} />
                <Text style={styles.workoutStackText}>Back & Biceps</Text>
              </View>
              <View
                style={[
                  styles.workoutListCard,
                  styles.workoutListCardMoreFaded,
                ]}
              >
                <View style={styles.workoutStackDot} />
                <Text style={styles.workoutStackText}>Chest & Triceps</Text>
              </View>
            </View>

            {/* Infinity Badge */}
            <View style={styles.workoutsInfinityBadge}>
              <Ionicons name="infinite" size={28} color="white" />
            </View>
          </View>
        </View>
      ),
    },
    {
      id: 'ai_coach',
      title: 'AI Workout Coach',
      description:
        'Generate personalized workouts and routines instantly with AI.',
      renderVisual: () => (
        <View style={[styles.visualContainer, { width: screenWidth - 48 }]}>
          <View style={styles.aiChatVisual}>
            {/* Chat Bubbles - Compact Layout */}
            <View style={styles.chatBubblesContainer}>
              <View style={[styles.chatBubble, styles.chatBubbleUser]}>
                <Text style={styles.chatTextUser}>
                  Build me a chest day routine
                </Text>
              </View>
              <View style={[styles.chatBubble, styles.chatBubbleAI]}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="sparkles" size={12} color="white" />
                </View>
                <Text style={styles.chatTextAI} numberOfLines={2}>
                  I&apos;ve created a chest routine focusing on hypertrophy...
                </Text>
              </View>
            </View>

            {/* Workout Card Snippet - Compact */}
            <View style={styles.workoutCardSnippet}>
              <View style={styles.workoutSnippetHeader}>
                <Text style={styles.workoutSnippetTitle}>
                  Chest Hypertrophy
                </Text>
                <View style={styles.workoutSnippetBadge}>
                  <Text style={styles.workoutSnippetBadgeText}>AI</Text>
                </View>
              </View>
              <View style={styles.workoutSnippetRow}>
                <Text style={styles.workoutSnippetExercise}>Bench Press</Text>
                <Text style={styles.workoutSnippetSets}>3 x 8-12</Text>
              </View>
              <View style={styles.workoutSnippetRow}>
                <Text style={styles.workoutSnippetExercise}>
                  Incline DB Press
                </Text>
                <Text style={styles.workoutSnippetSets}>3 x 10-12</Text>
              </View>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: 'stats',
      title: 'Advanced Analytics',
      description:
        'Visualize your progress with detailed charts and volume tracking.',
      renderVisual: () => (
        <View style={[styles.visualContainer, { width: screenWidth - 48 }]}>
          <View style={styles.statsVisual}>
            <Svg height="120" width="100%" viewBox="0 0 300 120">
              <Defs>
                <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <Stop
                    offset="0"
                    stopColor={colors.primary}
                    stopOpacity="0.8"
                  />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Path
                d="M0,100 C40,80 80,110 120,60 S200,40 300,10 L300,120 L0,120 Z"
                fill="url(#grad)"
              />
              <Path
                d="M0,100 C40,80 80,110 120,60 S200,40 300,10"
                fill="none"
                stroke={colors.primary}
                strokeWidth="4"
              />
              <Circle
                cx="120"
                cy="60"
                r="6"
                fill="white"
                stroke={colors.primary}
                strokeWidth="2"
              />
              <Circle
                cx="300"
                cy="10"
                r="6"
                fill="white"
                stroke={colors.primary}
                strokeWidth="2"
              />
            </Svg>
            <View style={styles.statsOverlay}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Volume</Text>
                <Text style={styles.statValue}>+15%</Text>
              </View>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: 'body_scan',
      title: 'Body Scan',
      description: 'Track your physique with AI-powered body analysis.',
      renderVisual: () => (
        <View style={[styles.visualContainer, { width: screenWidth - 48 }]}>
          <View style={styles.supportVisual}>
            <View style={styles.bodyScanContainer}>
              <Ionicons name="body" size={80} color={colors.primary} />
              <View style={styles.scanLineTop} />
              <View style={styles.scanLineBottom} />
            </View>
          </View>
        </View>
      ),
    },
  ]

  const { user, signInAnonymously } = useAuth()
  const {
    offerings,
    purchasePackage,
    isLoading: subscriptionLoading,
  } = useSubscription()
  const { requestPermission, hasPermission } = useNotifications()

  // Parse onboarding data for profile creation
  type OnboardingData = {
    name: string
    gender: Gender | null
    height_cm: number | null
    weight_kg: number | null
    age: number | null
    goal: Goal[]
    commitment: string[] | null
    training_years: TrainingYears | null
    bio: string | null
    coach: string | null
  }

  const onboardingData: OnboardingData | null = params.onboarding_data
    ? JSON.parse(params.onboarding_data as string)
    : null

  // Helper to update profile with onboarding data for anonymous user
  // Note: signInAnonymously in auth-context creates the basic profile
  const setupGuestProfile = async (userId: string) => {
    if (!onboardingData) return

    try {
      // Generate a unique user_tag based on the display name
      const userTag = await database.profiles.generateUniqueUserTag(
        onboardingData.name || 'Guest',
      )

      // Use upsert to ensure profile is created if it doesn't exist
      const profileUpdates: any = {
        id: userId,
        user_tag: userTag,
        display_name: onboardingData.name || 'Guest',
        gender: onboardingData.gender,
        height_cm: onboardingData.height_cm,
        weight_kg: onboardingData.weight_kg,
        age: onboardingData.age,
        goals: onboardingData.goal.length > 0 ? onboardingData.goal : null,
        commitment: onboardingData.commitment && onboardingData.commitment.length > 0 
          ? onboardingData.commitment 
          : null,
        training_years: onboardingData.training_years,
        bio: onboardingData.bio,
        coach: onboardingData.coach,
        is_guest: true,
      }

      const { error } = await supabase.from('profiles').upsert(profileUpdates)

      if (error) {
        // Handle missing column (migration not run yet)
        if (error.code === 'PGRST204' && profileUpdates.is_guest) {
          console.warn(
            '[TrialOffer] is_guest column missing, retrying without it.',
          )
          delete profileUpdates.is_guest
          const { error: retryError } = await supabase
            .from('profiles')
            .upsert(profileUpdates)
          if (retryError) throw retryError
        } else {
          throw error
        }
      }
    } catch (error) {
      console.error('[TrialOffer] Error setting up guest profile:', error)
      // Non-fatal - user can still use the app
    }
  }

  const {
    monthly: monthlyPackage,
    yearly: yearlyPackage,
  } = useRevenueCatPackages(offerings)

  const yearlySavings = useMemo(
    () => calculateYearlySavings(monthlyPackage, yearlyPackage),
    [monthlyPackage, yearlyPackage],
  )

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>(
    'yearly',
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

  // Note: canPurchase check removed - users now sign in anonymously directly

  const handleStartTrial = async () => {
    try {
      setIsPurchasing(true)

      trackEvent(AnalyticsEvents.TRIAL_OFFER_STEP_COMPLETED, {
        step: 3,
        step_name: 'payment_setup',
      })

      // If user isn't logged in, sign in anonymously first
      let currentUserId = user?.id
      if (!user) {
        const { userId } = await signInAnonymously()
        currentUserId = userId
        await setupGuestProfile(userId)
      }

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
        if (currentUserId) {
          const trialStartDate = new Date()
          await scheduleTrialExpirationNotification(
            currentUserId,
            trialStartDate,
          )
        }
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
  }

  const handleSkipTrial = async () => {
    // Track that user skipped the trial
    trackEvent(AnalyticsEvents.TRIAL_OFFER_SKIPPED, {})

    // If user is already logged in (including anonymous), go to app
    if (user) {
      router.replace('/(tabs)')
      return
    }

    // Sign in anonymously and go to app
    try {
      setIsPurchasing(true) // Reuse loading state
      const { userId } = await signInAnonymously()
      await setupGuestProfile(userId)
      router.replace('/(tabs)')
    } catch (error) {
      console.error('[TrialOffer] Anonymous sign-in error:', error)
      // Fallback: still try to enter the app
      router.replace('/(tabs)')
    } finally {
      setIsPurchasing(false)
    }
  }

  const renderStep1 = () => (
    <>
      {/* Header */}
      <View style={styles.step1HeaderContainer}>
        <View style={styles.step1HeaderSpacer} />
        <View style={styles.step1HeaderSpacer} />
      </View>

      <View style={styles.step1Content}>
        {/* Title */}
        <Animated.View
          style={styles.step1TitleContainer}
          entering={FadeInDown.delay(100).duration(600)}
        >
          <Text style={styles.step1Title}>Try </Text>
          <ProBadge size="large" />
          <Text style={styles.step1Title}> for FREE</Text>
        </Animated.View>

        {/* Feature Carousel */}
        <Animated.View
          style={styles.carouselContainer}
          entering={FadeInDown.delay(200).duration(600)}
        >
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleCarouselScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={screenWidth}
            contentContainerStyle={{ width: screenWidth * FEATURES.length }}
          >
            {FEATURES.map((feature) => (
              <View
                key={feature.id}
                style={[styles.slide, { width: screenWidth }]}
              >
                {feature.renderVisual()}
                <Text style={styles.slideTitle}>{feature.title}</Text>
                <Text style={styles.slideDescription}>
                  {feature.description}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Pagination Dots */}
          <View style={styles.pagination}>
            {FEATURES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === activeSlide
                    ? { backgroundColor: colors.primary, width: 20 }
                    : { backgroundColor: colors.textSecondary, opacity: 0.3 },
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </View>

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
                      selectedPlan === 'monthly' &&
                        styles.pricingOptionSelected,
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
          <Ionicons name={icon} size={22} color={colors.buttonText} />
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

function createStyles(colors: any, _screenHeight: number = 800) {
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
      marginBottom: 60,
      paddingHorizontal: 8,
      flexWrap: 'wrap',
    },
    step1Title: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    step1FeaturesContainer: {
      gap: 24,
      paddingTop: 8,
    },
    step1Content: {
      flex: 1,
      justifyContent: 'center',
    },
    // Carousel styles
    carouselContainer: {
      width: '100%',
      paddingTop: 0,
      paddingBottom: 0,
      alignItems: 'center',
    },
    slide: {
      alignItems: 'center',
      paddingHorizontal: 24,
      justifyContent: 'flex-start',
    },
    slideTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.5,
      marginTop: 24,
    },
    slideDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 24,
      minHeight: 48,
    },
    pagination: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    paginationDot: {
      height: 8,
      width: 8,
      borderRadius: 4,
    },
    // Visual container styles (matching paywall)
    visualContainer: {
      marginBottom: 24,
      marginTop: -20,
      alignItems: 'center',
      justifyContent: 'center',
      height: 180,
    },
    workoutsVisual: {
      width: '100%',
      height: 180,
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
      marginTop: 40,
    },
    calendarWeek: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 12,
    },
    calendarDay: {
      alignItems: 'center',
      gap: 6,
    },
    calendarDayLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    calendarDayCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarDayActive: {
      backgroundColor: colors.primary,
    },
    workoutCardsList: {
      width: '100%',
      alignItems: 'center',
      gap: 6,
    },
    workoutListCard: {
      width: '85%',
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    workoutListCardFaded: {
      opacity: 0.6,
    },
    workoutListCardMoreFaded: {
      opacity: 0.35,
    },
    workoutStackDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginRight: 10,
    },
    workoutStackText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    workoutStackBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    workoutStackBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    workoutsInfinityBadge: {
      position: 'absolute',
      bottom: 4,
      right: 32,
      backgroundColor: colors.primary,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    // AI Chat Visual
    aiChatVisual: {
      width: '100%',
      height: '100%',
      maxWidth: 320,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 24,
      gap: 12,
    },
    chatBubblesContainer: {
      width: '100%',
      gap: 8,
      marginBottom: 4,
    },
    chatBubble: {
      padding: 12,
      borderRadius: 16,
      maxWidth: '85%',
    },
    chatBubbleUser: {
      backgroundColor: colors.primary,
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    chatBubbleAI: {
      backgroundColor: colors.card,
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
      flexDirection: 'row',
      gap: 8,
    },
    chatTextUser: {
      color: colors.buttonText,
      fontSize: 13,
      fontWeight: '500',
    },
    chatTextAI: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
    aiAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -2,
    },
    workoutCardSnippet: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      width: '90%',
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    workoutSnippetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    workoutSnippetTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    workoutSnippetBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
    },
    workoutSnippetBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.primary,
    },
    workoutSnippetRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    workoutSnippetExercise: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '500',
    },
    workoutSnippetSets: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    // Stats Visual
    statsVisual: {
      width: '100%',
      height: 160,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      marginTop: 48,
    },
    statsOverlay: {
      position: 'absolute',
      top: -12,
      right: 24,
    },
    statBox: {
      backgroundColor: colors.card,
      padding: 10,
      borderRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    // Body Scan Visual
    bodyScanContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    scanLineTop: {
      position: 'absolute',
      top: 10,
      width: 100,
      height: 2,
      backgroundColor: colors.primary,
      opacity: 0.6,
    },
    scanLineBottom: {
      position: 'absolute',
      bottom: 10,
      width: 100,
      height: 2,
      backgroundColor: colors.primary,
      opacity: 0.6,
    },
    supportVisual: {
      width: '100%',
      height: 160,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      marginTop: 48,
    },
    // Step 3 specific styles
    step3ContentWrapper: {
      flex: 1,
    },
    step3ScrollContent: {
      paddingHorizontal: 24,
      paddingTop: 0,
      paddingBottom: 8,
      flexGrow: 1,
      justifyContent: 'space-between',
    },
    step3Title: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      paddingHorizontal: 16,
      lineHeight: 38,
      marginTop: 0,
      marginBottom: 24,
      letterSpacing: -0.5,
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
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
      paddingHorizontal: 16,
      letterSpacing: -0.5,
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
      marginBottom: 20,
    },
    timelineItem: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    timelineIconContainer: {
      alignItems: 'center',
      marginRight: 12,
    },
    timelineIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: colors.border,
      marginVertical: 2,
    },
    timelineContent: {
      flex: 1,
      paddingTop: 2,
      paddingBottom: 10,
    },
    timelineTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 3,
    },
    timelineDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    // Pricing Cards
    pricingCardsContainer: {
      gap: 12,
      marginBottom: 0,
      marginTop: 0,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    pricingOption: {
      flex: 1,
      maxWidth: 160,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 10,
      position: 'relative',
    },
    pricingOptionYearly: {
      position: 'relative',
      borderColor: colors.primary,
      backgroundColor: colors.background,
    },
    pricingOptionSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    pricingOptionContent: {
      alignItems: 'flex-start',
    },
    pricingOptionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    pricingOptionPrice: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    pricingOptionSubtext: {
      fontSize: 11,
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
      right: 12,
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
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
      paddingTop: 16,
      paddingBottom: 40,
      gap: 8,
    },
    footerSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    startButton: {
      height: 64,
      backgroundColor: colors.text,
      borderRadius: 32,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    startButtonText: {
      color: colors.background,
      fontSize: 18,
      fontWeight: '700',
    },
    skipButton: {
      height: 56,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    skipButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
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
