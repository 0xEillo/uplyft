import { HapticButton } from '@/components/haptic-button'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef } from 'react'
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CongratulationsScreen() {
  const params = useLocalSearchParams()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const styles = createStyles(colors)

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const statAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current

  // Parse onboarding data
  const onboardingData = params.onboarding_data
    ? JSON.parse(params.onboarding_data as string)
    : null

  const userName = onboardingData?.name || 'there'
  const userGoals = onboardingData?.goal || []
  const userAge = onboardingData?.age
  const trainingYears = onboardingData?.training_years
  const commitment = onboardingData?.commitment
  const gender = onboardingData?.gender

  // Format goals for compact display
  const getGoalShort = (goal: string) => {
    return goal.replace(/_/g, ' ')
  }

  // Get experience level text
  const getExperienceText = () => {
    if (trainingYears === 'less_than_1') return 'Less than 1 year'
    if (trainingYears === '1_to_3') return '1-3 years'
    if (trainingYears === '3_to_5') return '3-5 years'
    if (trainingYears === '5_plus') return '5+ years'
    return 'Training experience'
  }

  // Get commitment frequency text
  const getCommitmentText = () => {
    if (commitment === '2_times') return '2 times per week'
    if (commitment === '3_times') return '3 times per week'
    if (commitment === '4_times') return '4 times per week'
    if (commitment === '5_plus') return '5+ times per week'
    return 'Custom schedule'
  }

  useEffect(() => {
    // Success haptic when screen appears
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
      step: 'congratulations',
    })

    // Animate header and icon
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: 200,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start()

    // Stagger stat cards
    Animated.stagger(
      120,
      statAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
      ),
    ).start()
  }, [fadeAnim, slideAnim, scaleAnim, statAnims, trackEvent])

  const handleContinue = () => {
    router.push({
      pathname: '/(auth)/trial-offer',
      params: {
        onboarding_data: params.onboarding_data as string,
      },
    })
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.wrapper}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Celebration Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            Ready, {userName}!
          </Animated.Text>

          {/* Your Profile Section */}
          <Animated.View
            style={[
              styles.profileSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionLabel}>YOUR PROFILE</Text>

            {/* Profile Stats Grid */}
            <View style={styles.statsGrid}>
              {/* Goals */}
              <Animated.View
                style={[
                  styles.statCard,
                  {
                    opacity: statAnims[0],
                    transform: [
                      {
                        scale: statAnims[0].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.statLabel}>Goals</Text>
                <View style={styles.goalsContainer}>
                  {userGoals.map((goal: string, index: number) => (
                    <View key={index} style={styles.goalChip}>
                      <Text style={styles.goalChipText}>{getGoalShort(goal)}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>

              {/* Experience & Frequency Row */}
              <View style={styles.statRow}>
                <Animated.View
                  style={[
                    styles.statCardSmall,
                    {
                      opacity: statAnims[1],
                      transform: [
                        {
                          scale: statAnims[1].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.statLabel}>Experience</Text>
                  <Text style={styles.statValue}>{getExperienceText()}</Text>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.statCardSmall,
                    {
                      opacity: statAnims[2],
                      transform: [
                        {
                          scale: statAnims[2].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.statLabel}>Training</Text>
                  <Text style={styles.statValue}>{getCommitmentText()}</Text>
                </Animated.View>
              </View>
            </View>
          </Animated.View>

          {/* Next Steps */}
          <Animated.View
            style={[
              styles.nextStepsSection,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <Text style={styles.sectionLabel}>WHAT&apos;S NEXT</Text>

            <View style={styles.flowContainer}>
              <View style={styles.flowStep}>
                <View style={styles.flowIcon}>
                  <Ionicons name="chatbubble-ellipses" size={24} color={colors.primary} />
                </View>
                <Text style={styles.flowLabel}>Chat with AI Coach</Text>
              </View>

              <View style={styles.flowArrow}>
                <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
              </View>

              <View style={styles.flowStep}>
                <View style={styles.flowIcon}>
                  <Ionicons name="barbell" size={24} color={colors.primary} />
                </View>
                <Text style={styles.flowLabel}>Get Your Plan</Text>
              </View>

              <View style={styles.flowArrow}>
                <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
              </View>

              <View style={styles.flowStep}>
                <View style={styles.flowIcon}>
                  <Ionicons name="trophy" size={24} color={colors.primary} />
                </View>
                <Text style={styles.flowLabel}>Track Progress</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Footer Button */}
        <View style={styles.footer}>
          <HapticButton
            style={styles.continueButton}
            onPress={handleContinue}
            hapticEnabled={true}
            hapticStyle="heavy"
          >
            <Text style={styles.continueButtonText}>Let&apos;s get started!</Text>
          </HapticButton>
        </View>
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    wrapper: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    backButton: {
      padding: 4,
    },
    placeholder: {
      width: 32,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 24,
    },
    iconContainer: {
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 20,
    },
    iconWrapper: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primary + '12',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 38,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1.2,
      marginBottom: 12,
    },
    profileSection: {
      marginBottom: 32,
    },
    statsGrid: {
      gap: 12,
    },
    statRow: {
      flexDirection: 'row',
      gap: 12,
    },
    statCard: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    statCardSmall: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    goalsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    goalChip: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '25',
    },
    goalChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textTransform: 'capitalize',
    },
    statValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    nextStepsSection: {
      marginBottom: 16,
    },
    flowContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.backgroundLight,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    flowStep: {
      flex: 1,
      alignItems: 'center',
      gap: 8,
    },
    flowIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    flowLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 14,
    },
    flowArrow: {
      paddingHorizontal: 4,
      paddingBottom: 20,
    },
    footer: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      paddingBottom: 32,
    },
    continueButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    continueButtonText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
  })
