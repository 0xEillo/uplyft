import { TutorialStep, useTutorial } from '@/contexts/tutorial-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { memo, useCallback, useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    interpolate,
    useAnimatedStyle,
    useDerivedValue,
    withSpring,
} from 'react-native-reanimated'

interface TutorialChecklistProps {
  onDismiss?: () => void
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

// Individual step card with sequential flow design
const TutorialStepCard = memo(
  ({
    step,
    index,
    isCurrentStep,
    isLast,
    onPress,
    colors,
    isDark,
  }: {
    step: TutorialStep
    index: number
    isCurrentStep: boolean
    isLast: boolean
    onPress: (step: TutorialStep) => void
    colors: ReturnType<typeof useThemedColors>
    isDark: boolean
  }) => {
    const isCompleted = step.completed
    const isClickable = !isCompleted && step.route

    // Animated progress for the checkmark
    const progress = useDerivedValue(() => {
      return withSpring(isCompleted ? 1 : 0, {
        damping: 12,
        stiffness: 120,
      })
    }, [isCompleted])

    const checkmarkStyle = useAnimatedStyle(() => ({
      transform: [{ scale: progress.value }],
      opacity: progress.value,
    }))

    const numberStyle = useAnimatedStyle(() => ({
      opacity: interpolate(progress.value, [0, 1], [1, 0]),
      transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.5]) }],
    }))

    const handlePress = useCallback(() => {
      if (isClickable) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress(step)
      }
    }, [step, onPress, isClickable])

    // Colors based on state
    const getStepColors = () => {
      if (isCompleted) {
        return {
          iconBg: '#10B981',
          cardBg: isDark ? '#1A2E1A' : '#F0FDF4',
          border: '#10B98140',
          textColor: colors.textSecondary,
          connectorColor: '#10B981',
        }
      }
      if (isCurrentStep) {
        return {
          iconBg: colors.primary,
          cardBg: isDark ? '#1E1E1E' : '#FFFFFF',
          border: colors.primary + '60',
          textColor: colors.text,
          connectorColor: isDark ? '#2A2A2A' : '#E5E5E5',
        }
      }
      // Incomplete but not "next" step
      return {
        iconBg: isDark ? '#2A2A2A' : '#E5E5E5',
        cardBg: isDark ? '#1A1A1A' : '#F8F8F8',
        border: isDark ? '#252525' : '#EFEFEF',
        textColor: colors.textSecondary,
        connectorColor: isDark ? '#2A2A2A' : '#E5E5E5',
      }
    }

    const stepColors = getStepColors()

    return (
      <View style={styles.stepWrapper}>
        {/* Connector Line */}
        {!isLast && (
          <View
            style={[
              styles.connectorLine,
              { backgroundColor: stepColors.connectorColor },
            ]}
          />
        )}

        <AnimatedTouchable
          entering={FadeInDown.delay(100 + index * 80).duration(400).springify()}
          onPress={handlePress}
          activeOpacity={isClickable ? 0.7 : 0.9}
          style={[
            styles.stepCard,
            isCurrentStep && styles.currentStepCard,
            {
              backgroundColor: stepColors.cardBg,
              borderColor: stepColors.border,
            },
          ]}
        >
          {/* Step Number / Icon Container */}
          <View
            style={[
              styles.stepIndicator,
              isCurrentStep && styles.currentStepIndicator,
              { backgroundColor: stepColors.iconBg },
            ]}
          >
            {isCompleted ? (
              <Animated.View style={checkmarkStyle}>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              </Animated.View>
            ) : (
              <Animated.View style={numberStyle}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </Animated.View>
            )}
          </View>

          {/* Content */}
          <View style={styles.stepContent}>
            <View style={styles.stepTitleRow}>
              <Text
                style={[
                  styles.stepTitle,
                  isCurrentStep && styles.currentStepTitle,
                  {
                    color: stepColors.textColor,
                    textDecorationLine: isCompleted ? 'line-through' : 'none',
                  },
                ]}
                numberOfLines={1}
              >
                {step.title}
              </Text>
              {isCurrentStep && !isCompleted && (
                <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.currentBadgeText}>NEXT</Text>
                </View>
              )}
            </View>
            {!isCompleted && (
              <Text
                style={[styles.stepSubtitle, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                {step.description}
              </Text>
            )}
          </View>

          {/* Action Indicator */}
          <View
            style={[
              styles.actionContainer,
              {
                backgroundColor: isCompleted
                  ? '#10B98120'
                  : isCurrentStep
                  ? colors.primary
                  : isDark
                  ? '#2A2A2A'
                  : '#F0F0F0',
              },
            ]}
          >
            {isCompleted ? (
              <Ionicons name="checkmark" size={14} color="#10B981" />
            ) : (
              <Ionicons
                name="arrow-forward"
                size={14}
                color={isCurrentStep ? '#FFFFFF' : colors.textTertiary}
              />
            )}
          </View>
        </AnimatedTouchable>
      </View>
    )
  },
)

TutorialStepCard.displayName = 'TutorialStepCard'

export const TutorialChecklist = memo(
  ({ onDismiss }: TutorialChecklistProps) => {
    const colors = useThemedColors()
    const router = useRouter()
    const isDark = colors.background === '#141414'
    const {
      tutorialSteps,
      isTutorialComplete,
      dismissTutorial,
      completedSteps,
    } = useTutorial()

    const completedCount = completedSteps.size
    const totalSteps = tutorialSteps.length
    const progressPercent = (completedCount / totalSteps) * 100

    // Find the current step (first incomplete step)
    const currentStepIndex = tutorialSteps.findIndex((s) => !s.completed)

    const handleStepPress = useCallback(
      (step: TutorialStep) => {
        if (step.route && !step.completed) {
          router.push(step.route as any)
        }
      },
      [router],
    )

    const handleDismiss = useCallback(async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await dismissTutorial()
      onDismiss?.()
    }, [dismissTutorial, onDismiss])

    // Dynamic greeting based on progress
    const greeting = useMemo(() => {
      if (isTutorialComplete) return "You're all set! 🎉"
      if (completedCount === 0) return 'Welcome to Rep AI'
      if (completedCount < totalSteps / 2) return 'Great start!'
      return 'Almost there!'
    }, [isTutorialComplete, completedCount, totalSteps])

    const subtitle = useMemo(() => {
      if (isTutorialComplete) return 'You\'ve completed your getting started guide'
      const remaining = totalSteps - completedCount
      return `Step ${completedCount + 1} of ${totalSteps} — ${remaining} ${
        remaining === 1 ? 'step' : 'steps'
      } remaining`
    }, [isTutorialComplete, completedCount, totalSteps])

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[
          styles.container,
          {
            backgroundColor: isDark ? '#141414' : '#FAFAFA',
          },
        ]}
      >
        {/* Header Section */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(400)}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={[styles.greeting, { color: colors.text }]}>
              {greeting}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          </View>

          {/* Circular Progress */}
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressRing,
                {
                  backgroundColor: isTutorialComplete
                    ? '#10B98115'
                    : isDark
                    ? '#1E1E1E'
                    : '#FFFFFF',
                  borderColor: isTutorialComplete
                    ? '#10B981'
                    : colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.progressNumber,
                  {
                    color: isTutorialComplete ? '#10B981' : colors.primary,
                  },
                ]}
              >
                {completedCount}
                <Text style={styles.progressSlash}>/</Text>
                {totalSteps}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Progress Bar */}
        <View
          style={[
            styles.progressBar,
            { backgroundColor: isDark ? '#2A2A2A' : '#E5E5E5' },
          ]}
        >
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: isTutorialComplete ? '#10B981' : colors.primary,
              },
            ]}
          />
        </View>

        {/* Steps List with Sequential Flow */}
        <View style={styles.stepsList}>
          {tutorialSteps.map((step, index) => (
            <TutorialStepCard
              key={step.id}
              step={step}
              index={index}
              isCurrentStep={index === currentStepIndex}
              isLast={index === tutorialSteps.length - 1}
              onPress={handleStepPress}
              colors={colors}
              isDark={isDark}
            />
          ))}
        </View>

        {/* Dismiss Button - Only when complete */}
        {isTutorialComplete && (
          <Animated.View
            entering={FadeInDown.delay(400).duration(300)}
            style={styles.dismissContainer}
          >
            <TouchableOpacity
              onPress={handleDismiss}
              activeOpacity={0.8}
              style={styles.dismissButton}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dismissGradient}
              >
                <Text style={styles.dismissText}>Finish</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    )
  },
)

TutorialChecklist.displayName = 'TutorialChecklist'

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  headerContent: {
    flex: 1,
    paddingRight: 16,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressNumber: {
    fontSize: 17,
    fontWeight: '700',
  },
  progressSlash: {
    fontWeight: '400',
    opacity: 0.5,
  },
  progressBar: {
    height: 4,
    marginHorizontal: 14,
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepsList: {
    paddingHorizontal: 16,
  },
  stepWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  connectorLine: {
    position: 'absolute',
    left: 27,
    top: 56,
    width: 2,
    height: 24,
    zIndex: 0,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    zIndex: 1,
  },
  currentStepCard: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  stepIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentStepIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  stepNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  currentStepTitle: {
    fontWeight: '700',
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stepSubtitle: {
    fontSize: 13,
  },
  actionContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  dismissContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dismissButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  dismissGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  dismissText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
