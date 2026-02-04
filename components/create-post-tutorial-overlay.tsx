import { useThemedColors } from '@/hooks/useThemedColors'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface CreatePostTutorialHighlightLayout {
  x: number
  y: number
  width: number
  height: number
}

export interface CreatePostTutorialStep {
  id: string
  title: string
  description: string
  ref: React.RefObject<View>
  layout?: CreatePostTutorialHighlightLayout | null
}

interface CreatePostTutorialOverlayProps {
  visible: boolean
  steps: CreatePostTutorialStep[]
  onSkip: () => void
  onDone: () => void
}

export function CreatePostTutorialOverlay({
  visible,
  steps,
  onSkip,
  onDone,
}: CreatePostTutorialOverlayProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [highlightLayout, setHighlightLayout] =
    useState<CreatePostTutorialHighlightLayout | null>(null)
  const [tooltipHeight, setTooltipHeight] = useState(0)

  const pulseAnim = useRef(new Animated.Value(0)).current

  const currentStep = steps[currentStepIndex]
  const isLastStep = currentStepIndex === steps.length - 1

  const measureCurrentStep = useCallback(() => {
    if (currentStep?.layout) {
      setHighlightLayout(currentStep.layout)
      return
    }
    if (!currentStep?.ref?.current) {
      setHighlightLayout(null)
      return
    }

    currentStep.ref.current.measureInWindow((x, y, width, height) => {
      if (width === 0 && height === 0) {
        setHighlightLayout(null)
        return
      }

      setHighlightLayout({ x, y, width, height })
    })
  }, [currentStep])

  useEffect(() => {
    if (!visible) return
    setCurrentStepIndex(0)
    setHighlightLayout(null)
    setTooltipHeight(0)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    pulseAnim.setValue(0)
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()

    return () => {
      animation.stop()
    }
  }, [pulseAnim, visible])

  useEffect(() => {
    if (!visible) return

    let rafId = requestAnimationFrame(measureCurrentStep)
    const shortTimeoutId = setTimeout(measureCurrentStep, 120)
    const longTimeoutId = setTimeout(measureCurrentStep, 420)
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      measureCurrentStep()
    })

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(shortTimeoutId)
      clearTimeout(longTimeoutId)
      interactionHandle.cancel?.()
    }
  }, [currentStepIndex, measureCurrentStep, visible, window.height, window.width])

  if (!visible || steps.length === 0) {
    return null
  }

  const highlightPadding = 8
  const safeTop = insets.top + 12
  const safeBottom = insets.bottom + 12

  const highlightStyle = highlightLayout
    ? {
        left: highlightLayout.x - highlightPadding,
        top: highlightLayout.y - highlightPadding,
        width: highlightLayout.width + highlightPadding * 2,
        height: highlightLayout.height + highlightPadding * 2,
        borderRadius: Math.max(
          12,
          (highlightLayout.height + highlightPadding * 2) / 2,
        ),
      }
    : null

  const tooltipPreferredTop = highlightLayout
    ? highlightLayout.y + highlightLayout.height + highlightPadding + 12
    : safeTop + 60
  const tooltipPreferredBottom = highlightLayout
    ? highlightLayout.y - highlightPadding - 12 - tooltipHeight
    : safeTop + 60

  let tooltipTop = tooltipPreferredTop
  if (
    tooltipHeight > 0 &&
    tooltipPreferredTop + tooltipHeight > window.height - safeBottom &&
    tooltipPreferredBottom > safeTop
  ) {
    tooltipTop = tooltipPreferredBottom
  }
  tooltipTop = Math.max(
    safeTop,
    Math.min(tooltipTop, window.height - safeBottom - tooltipHeight),
  )

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  })
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  })

  const handleNext = () => {
    if (isLastStep) {
      onDone()
      return
    }
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} />

        <View style={[styles.topBar, { paddingTop: safeTop }]}>
          <Text style={styles.progressText}>
            {currentStepIndex + 1} / {steps.length}
          </Text>
          <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {highlightStyle && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.highlight,
              highlightStyle,
              {
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
              },
            ]}
          />
        )}

        <View
          style={[styles.tooltip, { top: tooltipTop }]}
          onLayout={(event) => setTooltipHeight(event.nativeEvent.layout.height)}
        >
          <Text style={styles.tooltipTitle}>{currentStep.title}</Text>
          <Text style={styles.tooltipBody}>{currentStep.description}</Text>
          <View style={styles.tooltipFooter}>
            <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
              <Text style={styles.nextButtonText}>
                {isLastStep ? 'Done' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
    },
    topBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
    },
    progressText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    skipButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    skipText: {
      color: colors.surface,
      fontSize: 13,
      fontWeight: '600',
    },
    highlight: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: colors.brandPrimary,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      shadowColor: colors.brandPrimary,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    tooltip: {
      position: 'absolute',
      left: 16,
      right: 16,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    tooltipTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    tooltipBody: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 6,
    },
    tooltipFooter: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    progressHint: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '500',
    },
    nextButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: colors.brandPrimary,
    },
    nextButtonText: {
      color: colors.surface,
      fontSize: 13,
      fontWeight: '700',
    },
  })
