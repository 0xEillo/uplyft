import { useTutorial } from '@/contexts/tutorial-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { memo, useCallback } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

/**
 * Compact tutorial progress card for profile page.
 * Shows progress and links to full tutorial page.
 */
export const TutorialProgressCard = memo(() => {
  const colors = useThemedColors()
  const router = useRouter()
  const isDark = colors.background === '#141414'
  const { tutorialSteps, completedSteps, isTutorialComplete, isTutorialDismissed } = useTutorial()

  // Don't show if dismissed or complete
  if (isTutorialDismissed || isTutorialComplete) return null

  const completedCount = completedSteps.size
  const totalSteps = tutorialSteps.length
  const progressPercent = (completedCount / totalSteps) * 100

  // Find current step
  const currentStep = tutorialSteps.find((s) => !s.completed)

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/tutorial')
  }, [router])

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          styles.container,
          {
            backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
            borderColor: isTutorialComplete
              ? '#10B98130'
              : colors.primary + '30',
          },
        ]}
      >
        {/* Left: Progress Ring */}
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
              styles.progressText,
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

        {/* Middle: Content */}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isTutorialComplete ? 'Tutorial Complete!' : 'Getting Started'}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {isTutorialComplete
              ? 'View your completed guide'
              : currentStep
              ? `Next: ${currentStep.title}`
              : 'Continue your setup'}
          </Text>
        </View>

        {/* Right: Arrow */}
        <View
          style={[
            styles.arrowContainer,
            {
              backgroundColor: isTutorialComplete
                ? '#10B98115'
                : isDark
                ? '#2A2A2A'
                : '#F5F5F5',
            },
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={isTutorialComplete ? '#10B981' : colors.textSecondary}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
})

TutorialProgressCard.displayName = 'TutorialProgressCard'

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  progressRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressSlash: {
    fontWeight: '400',
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
})
