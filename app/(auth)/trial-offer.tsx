import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useRevenueCatPackages } from '@/hooks/useRevenueCatPackages'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { scheduleTrialExpirationNotification } from '@/lib/services/notification-service'
import { supabase } from '@/lib/supabase'
import { ExperienceLevel, Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

export default function TrialOfferScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const { height: screenHeight } = Dimensions.get('window')
  const styles = createStyles(colors, screenHeight)
  const { trackEvent } = useAnalytics()

  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(1) // Default to Yearly (middle option)
  const [isTrialEnabled, setIsTrialEnabled] = useState(true)

  const { user, signInAnonymously } = useAuth()
  const { offerings, purchasePackage, restorePurchases } = useSubscription()
  const { requestPermission, hasPermission } = useNotifications()

  // Parse onboarding data
  type OnboardingData = {
    name: string
    gender: Gender | null
    height_cm: number | null
    weight_kg: number | null
    age: number | null
    goal: Goal[]
    commitment: string[] | null
    experience_level: ExperienceLevel | null
    bio: string | null
    coach: string | null
  }

  const onboardingData: OnboardingData | null = params.onboarding_data
    ? JSON.parse(params.onboarding_data as string)
    : null

  const setupGuestProfile = async (userId: string) => {
    if (!onboardingData) return

    try {
      const userTag = await database.profiles.generateUniqueUserTag(
        onboardingData.name || 'Guest',
      )

      const profileUpdates: {
        id: string
        user_tag: string
        display_name: string
        gender: Gender | null
        height_cm: number | null
        weight_kg: number | null
        age: number | null
        goals: Goal[] | null
        commitment: string[] | null
        experience_level: ExperienceLevel | null
        bio: string | null
        coach?: string | null
        is_guest?: boolean
      } = {
        id: userId,
        user_tag: userTag,
        display_name: onboardingData.name || 'Guest',
        gender: onboardingData.gender,
        height_cm: onboardingData.height_cm,
        weight_kg: onboardingData.weight_kg,
        age: onboardingData.age,
        goals: onboardingData.goal.length > 0 ? onboardingData.goal : null,
        commitment:
          onboardingData.commitment && onboardingData.commitment.length > 0
            ? onboardingData.commitment
            : null,
        experience_level: onboardingData.experience_level,
        bio: onboardingData.bio,
        coach: onboardingData.coach,
        is_guest: true,
      }

      const { error } = await supabase.from('profiles').upsert(profileUpdates)

      if (error) {
        if (error.code === 'PGRST204' && profileUpdates.is_guest) {
          delete profileUpdates.is_guest
          await supabase.from('profiles').upsert(profileUpdates)
        } else {
          throw error
        }
      }
    } catch (error) {
      console.error('[TrialOffer] Error setting up guest profile:', error)
    }
  }

  const {
    monthly: monthlyPackage,
    yearly: yearlyPackage,
  } = useRevenueCatPackages(offerings)

  // Plans array matching screenshot layout
  const plans = useMemo(() => {
    const monthlyPrice = monthlyPackage?.product.priceString || 'US$5,99'
    const yearlyPrice = yearlyPackage?.product.priceString || 'US$24,99'

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

  const selectedTrialPackage = plans[selectedPlanIndex].package

  // Dynamic Title based on onboarding goals
  const dynamicTitle = useMemo(() => {
    if (
      !onboardingData ||
      !onboardingData.goal ||
      onboardingData.goal.length === 0
    ) {
      return 'Get full access to your personalized plan!'
    }

    const goals = onboardingData.goal
    if (goals.includes('build_muscle'))
      return 'Get full access to your muscle building plan!'
    if (goals.includes('lose_fat'))
      return 'Get full access to your weight loss plan!'
    if (goals.includes('gain_strength'))
      return 'Get full access to your strength plan!'
    if (goals.includes('improve_cardio'))
      return 'Get full access to your cardio plan!'
    if (goals.includes('become_flexible'))
      return 'Get full access to your flexibility plan!'

    return 'Get full access to your personalized plan!'
  }, [onboardingData])

  const getHeroImage = () => {
    if (onboardingData?.gender === 'female') {
      return require('@/assets/images/onboarding/female_muscle_flex.png')
    }
    return require('@/assets/images/onboarding/male_muscle_flex.png')
  }

  const hasTrackedViewRef = useRef(false)

  useEffect(() => {
    if (hasTrackedViewRef.current) return
    hasTrackedViewRef.current = true

    trackEvent(AnalyticsEvents.TRIAL_OFFER_VIEWED, {
      action: 'viewed',
      plan_type: plans[selectedPlanIndex]?.type || 'yearly',
      trial_enabled: isTrialEnabled,
    })
  }, [isTrialEnabled, plans, selectedPlanIndex, trackEvent]) // Only track on first render

  const handleStartTrial = async () => {
    const selectedPlan = plans[selectedPlanIndex]

    try {
      setIsPurchasing(true)

      let currentUserId = user?.id
      if (!user) {
        const { userId } = await signInAnonymously()
        currentUserId = userId
        await setupGuestProfile(userId)
      }

      let targetPackage = selectedTrialPackage
      if (!targetPackage) {
        const fallback = offerings?.availablePackages?.[0]
        if (!fallback) throw new Error('No packages available.')
        targetPackage = fallback
      }

      // Track subscription started BEFORE purchase attempt
      trackEvent(AnalyticsEvents.SUBSCRIPTION_STARTED, {
        plan_type: selectedPlan.type,
        product_id: targetPackage.identifier,
        price_string: targetPackage.product.priceString,
        price: targetPackage.product.price,
        currency: targetPackage.product.currencyCode,
        trial_enabled: isTrialEnabled,
        trial_duration_days: isTrialEnabled ? 7 : 0,
        source_screen: 'trial_offer',
        subscription_action: 'started',
      })

      // Note: RevenueCat free trials are configured at the product level in App Store Connect / Google Play Console.
      // When isTrialEnabled is true, the user will get the trial offer if available on the product.
      // When isTrialEnabled is false, the purchase still goes through but the user is agreeing to pay immediately.
      // The actual trial eligibility is determined by the store, not by this toggle.
      const updatedCustomerInfo = await purchasePackage(
        targetPackage.identifier,
      )
      const hasProEntitlement = Boolean(
        updatedCustomerInfo?.entitlements.active['Pro'],
      )

      if (!hasProEntitlement) {
        Alert.alert(
          'Subscription Pending',
          'Purchase successful but taking a moment to activate.',
          [{ text: 'OK' }],
        )
      }

      // Track successful subscription completion
      trackEvent(AnalyticsEvents.SUBSCRIPTION_COMPLETED, {
        plan_type: selectedPlan.type,
        product_id: targetPackage.identifier,
        price_string: targetPackage.product.priceString,
        price: targetPackage.product.price,
        currency: targetPackage.product.currencyCode,
        trial_enabled: isTrialEnabled,
        trial_duration_days: isTrialEnabled ? 7 : 0,
        source_screen: 'trial_offer',
        subscription_action: 'completed',
        entitlement_granted: hasProEntitlement,
      })

      try {
        // Only schedule trial notification if trial is enabled
        if (isTrialEnabled) {
          if (!hasPermission) await requestPermission()
          if (currentUserId) {
            await scheduleTrialExpirationNotification(currentUserId, new Date())
          }
        }
      } catch {}

      trackEvent(AnalyticsEvents.TRIAL_OFFER_ACCEPTED, {
        action: 'accepted',
        plan_type: selectedPlan.type,
        trial_enabled: isTrialEnabled,
        price_string: targetPackage.product.priceString,
      })
      router.replace('/(tabs)')
    } catch (error) {
      const e = error as { userCancelled?: boolean; message?: string }
      const selectedPlan = plans[selectedPlanIndex]

      if (e?.userCancelled) {
        // User cancelled the purchase
        trackEvent(AnalyticsEvents.SUBSCRIPTION_CANCELLED, {
          plan_type: selectedPlan.type,
          product_id: selectedTrialPackage?.identifier,
          price_string: selectedTrialPackage?.product.priceString,
          source_screen: 'trial_offer',
          subscription_action: 'cancelled',
        })
      } else {
        // Actual error occurred
        trackEvent(AnalyticsEvents.SUBSCRIPTION_FAILED, {
          plan_type: selectedPlan.type,
          product_id: selectedTrialPackage?.identifier,
          price_string: selectedTrialPackage?.product.priceString,
          source_screen: 'trial_offer',
          subscription_action: 'failed',
          error_message: e?.message || 'Unknown error',
        })
        Alert.alert('Error', e?.message || 'Failed to complete purchase', [
          { text: 'OK' },
        ])
      }
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleRestore = async () => {
    try {
      setIsRestoring(true)

      // Track restore attempt
      trackEvent(AnalyticsEvents.SUBSCRIPTION_RESTORED, {
        source_screen: 'trial_offer',
        subscription_action: 'restored',
        is_restore: true,
      })

      const restoredCustomerInfo = await restorePurchases()

      const hasProEntitlement = Boolean(
        restoredCustomerInfo?.entitlements.active['Pro'],
      )

      if (hasProEntitlement) {
        Alert.alert('Success!', 'Your purchases have been restored.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') },
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

  // Dynamic button text based on trial toggle
  const buttonText = useMemo(() => {
    if (isTrialEnabled) {
      return 'Start Free Trial'
    }
    return 'Subscribe Now'
  }, [isTrialEnabled])

  const handleSkipTrial = async () => {
    trackEvent(AnalyticsEvents.TRIAL_OFFER_SKIPPED, {
      action: 'skipped',
      plan_type: plans[selectedPlanIndex]?.type,
      trial_enabled: isTrialEnabled,
    })
    if (user) {
      router.replace('/(tabs)')
      return
    }

    try {
      setIsPurchasing(true)
      const { userId } = await signInAnonymously()
      await setupGuestProfile(userId)
      router.replace('/(tabs)')
    } catch {
      router.replace('/(tabs)')
    } finally {
      setIsPurchasing(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Hero Image Section */}
      <View style={styles.heroImageContainer}>
        <Image
          source={getHeroImage()}
          style={styles.heroImage}
          contentFit="cover"
        />

        {/* Top Buttons Overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleSkipTrial}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

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
            {dynamicTitle}
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
                      <Text
                        style={[
                          styles.planLabel,
                          isSelected && styles.planLabelSelected,
                        ]}
                      >
                        {plan.label}
                      </Text>
                      {plan.subtitle && (
                        <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
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

          {/* Free Trial Toggle */}
          <View style={styles.trialToggleContainer}>
            <Text style={styles.trialToggleText}>Try free for 7-days</Text>
            <View style={styles.switchContainer}>
              <Switch
                value={isTrialEnabled}
                onValueChange={setIsTrialEnabled}
                trackColor={{ false: colors.border, true: colors.brandPrimary }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.border}
              />
            </View>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.mainButton}
            onPress={handleStartTrial}
            disabled={isPurchasing || isRestoring}
            activeOpacity={0.8}
          >
            {isPurchasing ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.mainButtonText}>{buttonText}</Text>
            )}
          </TouchableOpacity>

          {/* Footer text */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerGuarenteeText}>
              {selectedPlanIndex === 1
                ? 'Billed annually. '
                : 'Billed monthly. '}
              Cancel anytime.
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function createStyles(
  colors: ReturnType<typeof useThemedColors>,
  screenHeight: number = 800,
) {
  const { height } = Dimensions.get('window')

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    heroImageContainer: {
      width: '100%',
      height: height * 0.4,
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
      width: 44,
      height: 44,
      borderRadius: 22,
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
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 22,
    },
    restoreButtonText: {
      fontSize: 15,
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
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 24,
    },
    heroTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
      borderRadius: 18,
      height: 74,
      borderWidth: 1,
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
      borderColor: colors.brandPrimary,
      backgroundColor: colors.surface,
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
      backgroundColor: colors.brandPrimary,
    },
    cardBadgeText: {
      color: colors.surface,
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
      color: colors.textPrimary,
      fontWeight: '700',
    },
    planPrice: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    planPriceSelected: {
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
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
      color: colors.textPrimary,
      flex: 1,
    },
    switchContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainButton: {
      width: '100%',
      height: 64,
      backgroundColor: colors.textPrimary,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    mainButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.bg,
      letterSpacing: 0.3,
    },
    footerContainer: {
      alignItems: 'center',
      marginTop: 16,
    },
    footerGuarenteeText: {
      textAlign: 'center',
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '500',
    },
  })
}
