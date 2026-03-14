import { useThemedColors } from '@/hooks/useThemedColors'
import { runAfterInteractions } from '@/lib/utils/run-after-interactions'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, Mask, Rect } from 'react-native-svg'

interface TargetRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TutorialStepConfig {
  id: string
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  measureTarget?: () => Promise<TargetRect | null>
  bullets?: { icon: keyof typeof Ionicons.glyphMap; label: string; detail: string }[]
  footer?: string
}

interface CreatePostTutorialProps {
  steps: TutorialStepConfig[]
  visible: boolean
  onComplete: () => void
  onStepPress?: (stepId: string) => void
}

const SPOTLIGHT_PADDING = 10
const SPOTLIGHT_RADIUS = 28
const MEASUREMENT_MAX_ATTEMPTS = 8
const MEASUREMENT_RETRY_DELAY_MS = 32
const WINDOW_BOUNDS_TOLERANCE = 16

function isTargetRectInWindow(
  rect: TargetRect | null,
  screenWidth: number,
  screenHeight: number,
) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return false
  }

  return (
    rect.x >= -WINDOW_BOUNDS_TOLERANCE &&
    rect.y >= -WINDOW_BOUNDS_TOLERANCE &&
    rect.x + rect.width <= screenWidth + WINDOW_BOUNDS_TOLERANCE &&
    rect.y + rect.height <= screenHeight + WINDOW_BOUNDS_TOLERANCE
  )
}

export function CreatePostTutorial({
  steps,
  visible,
  onComplete,
  onStepPress,
}: CreatePostTutorialProps) {
  const colors = useThemedColors()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)

  const backdropOpacity = useSharedValue(0)
  const tooltipTranslateY = useSharedValue(20)
  const tooltipOpacity = useSharedValue(0)
  const spotlightScale = useSharedValue(0.5)
  const spotlightOpacity = useSharedValue(0)
  const pulseScale = useSharedValue(1)

  const step = steps[currentStep]

  const [noTargetReady, setNoTargetReady] = useState(false)
  const measurementVersionRef = useRef(0)
  const pendingMeasurementRef = useRef<{ cancel?: () => void } | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingMeasurement = useCallback(() => {
    measurementVersionRef.current += 1
    pendingMeasurementRef.current?.cancel?.()
    pendingMeasurementRef.current = null
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [])

  const measureStep = useCallback(
    async (attempt = 0, measurementVersion = measurementVersionRef.current) => {
      if (!step || !visible) return

      if (!step.measureTarget) {
        setTargetRect(null)
        setNoTargetReady(true)
        return
      }

      try {
        const rect = await step.measureTarget()
        const inWindow = isTargetRectInWindow(rect, screenWidth, screenHeight)

        if (measurementVersion !== measurementVersionRef.current || !visible) {
          return
        }

        if (inWindow) {
          setTargetRect(rect)
          setNoTargetReady(false)
          return
        }

        if (attempt < MEASUREMENT_MAX_ATTEMPTS) {
          retryTimeoutRef.current = setTimeout(() => {
            void measureStep(attempt + 1, measurementVersion)
          }, MEASUREMENT_RETRY_DELAY_MS)
          return
        }

        setTargetRect(null)
        setNoTargetReady(true)
      } catch {
        if (measurementVersion !== measurementVersionRef.current || !visible) {
          return
        }

        if (attempt < MEASUREMENT_MAX_ATTEMPTS) {
          retryTimeoutRef.current = setTimeout(() => {
            void measureStep(attempt + 1, measurementVersion)
          }, MEASUREMENT_RETRY_DELAY_MS)
          return
        }

        setTargetRect(null)
        setNoTargetReady(true)
      }
    },
    [screenHeight, screenWidth, step, visible],
  )

  // Measure when step changes or overlay becomes visible
  useEffect(() => {
    clearPendingMeasurement()
    setTargetRect(null)
    setNoTargetReady(false)

    if (!visible || !step) {
      return clearPendingMeasurement
    }

    if (!step.measureTarget) {
      setNoTargetReady(true)
      return clearPendingMeasurement
    }

    const measurementVersion = measurementVersionRef.current
    pendingMeasurementRef.current = runAfterInteractions(() => {
      requestAnimationFrame(() => {
        void measureStep(0, measurementVersion)
      })
    })

    return clearPendingMeasurement
  }, [clearPendingMeasurement, currentStep, measureStep, step, visible])

  useEffect(() => clearPendingMeasurement, [clearPendingMeasurement])

  // Animate in when target is measured
  useEffect(() => {
    if (!visible) {
      backdropOpacity.value = withTiming(0, { duration: 200 })
      return
    }
    backdropOpacity.value = withTiming(1, { duration: 350 })
  }, [visible, backdropOpacity])

  useEffect(() => {
    if ((!targetRect && !noTargetReady) || !visible) return

    tooltipTranslateY.value = 20
    tooltipOpacity.value = 0

    if (targetRect) {
      spotlightScale.value = 0.5
      spotlightOpacity.value = 0

      spotlightScale.value = withDelay(
        100,
        withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.2)) }),
      )
      spotlightOpacity.value = withDelay(
        100,
        withTiming(1, { duration: 300 }),
      )

      // Pulse ring on the spotlight
      pulseScale.value = 1
      pulseScale.value = withDelay(
        500,
        withSequence(
          withTiming(1.4, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 400, easing: Easing.in(Easing.ease) }),
        ),
      )
    }

    tooltipTranslateY.value = withDelay(
      targetRect ? 250 : 100,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.ease) }),
    )
    tooltipOpacity.value = withDelay(
      targetRect ? 250 : 100,
      withTiming(1, { duration: 300 }),
    )
  }, [
    targetRect,
    noTargetReady,
    visible,
    tooltipTranslateY,
    tooltipOpacity,
    spotlightScale,
    spotlightOpacity,
    pulseScale,
  ])

  const handleNext = useCallback(() => {
    if (step && onStepPress) onStepPress(step.id)

    if (currentStep < steps.length - 1) {
      setTargetRect(null)
      setNoTargetReady(false)
      setCurrentStep((prev) => prev + 1)
    } else {
      onComplete()
      setCurrentStep(0)
      setTargetRect(null)
      setNoTargetReady(false)
    }
  }, [currentStep, steps.length, onComplete, step, onStepPress])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [{ translateY: tooltipTranslateY.value }],
  }))

  const spotlightStyle = useAnimatedStyle(() => ({
    opacity: spotlightOpacity.value,
    transform: [{ scale: spotlightScale.value }],
  }))

  const pulseRingStyle = useAnimatedStyle(() => ({
    opacity: 0.3 * (2 - pulseScale.value),
    transform: [{ scale: pulseScale.value }],
  }))

  if (!visible || !step) return null

  const isLastStep = currentStep === steps.length - 1
  const spotlightCx = targetRect
    ? targetRect.x + targetRect.width / 2
    : screenWidth / 2
  const spotlightCy = targetRect
    ? targetRect.y + targetRect.height / 2
    : screenHeight / 2
  const spotW = targetRect
    ? targetRect.width + SPOTLIGHT_PADDING * 2
    : 60
  const spotH = targetRect
    ? targetRect.height + SPOTLIGHT_PADDING * 2
    : 60
  const spotRadius = Math.min(SPOTLIGHT_RADIUS, spotW / 2, spotH / 2)

  // Determine tooltip position (above or below spotlight)
  const tooltipAbove = targetRect ? spotlightCy > screenHeight * 0.5 : false
  const showTooltip = Boolean(targetRect) || noTargetReady

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim backdrop with cutout hole */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="auto">
        <Svg width={screenWidth} height={screenHeight} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="cutout">
              <Rect x="0" y="0" width={screenWidth} height={screenHeight} fill="white" />
              {targetRect && (
                <Rect
                  x={spotlightCx - spotW / 2}
                  y={spotlightCy - spotH / 2}
                  width={spotW}
                  height={spotH}
                  rx={spotRadius}
                  ry={spotRadius}
                  fill="black"
                />
              )}
            </Mask>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={screenWidth}
            height={screenHeight}
            fill="rgba(0,0,0,0.65)"
            mask="url(#cutout)"
          />
        </Svg>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleNext}
        />
      </Animated.View>

      {/* Spotlight border + pulse (only for targeted steps) */}
      {targetRect && (
        <>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                left: spotlightCx - spotW / 2 - 6,
                top: spotlightCy - spotH / 2 - 6,
                width: spotW + 12,
                height: spotH + 12,
                borderRadius: spotRadius + 6,
                borderColor: colors.brandPrimary,
              },
              pulseRingStyle,
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.spotlight,
              {
                left: spotlightCx - spotW / 2,
                top: spotlightCy - spotH / 2,
                width: spotW,
                height: spotH,
                borderRadius: spotRadius,
                borderColor: colors.brandPrimary,
              },
              spotlightStyle,
            ]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={0.7}
              onPress={handleNext}
            />
          </Animated.View>
        </>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <Animated.View
          style={[
            styles.tooltipContainer,
            targetRect
              ? tooltipAbove
                ? { bottom: screenHeight - spotlightCy + spotH / 2 + 16 }
                : { top: spotlightCy + spotH / 2 + 16 }
              : styles.tooltipCentered,
            tooltipStyle,
          ]}
        >
          <View style={[styles.tooltip, { backgroundColor: colors.surfaceCard }]}>
            <View style={[styles.tooltipHeader, !step.description && styles.tooltipHeaderCentered]}>
              <View style={[styles.tooltipIconBg, { backgroundColor: colors.brandPrimary + '18' }]}>
                <Ionicons name={step.icon} size={20} color={colors.brandPrimary} />
              </View>
              <View style={styles.tooltipTextGroup}>
                <Text style={[styles.tooltipTitle, { color: colors.textPrimary }]}>
                  {step.title}
                </Text>
                {!!step.description && (
                  <Text style={[styles.tooltipDescription, { color: colors.textSecondary }]}>
                    {step.description}
                  </Text>
                )}
              </View>
            </View>

            {step.bullets && (
              <View style={styles.bulletList}>
                {step.bullets.map((b, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={[styles.bulletBadge, { backgroundColor: colors.brandPrimary }]}>
                      <Text style={styles.bulletBadgeText}>{i + 1}</Text>
                    </View>
                    <View style={styles.bulletContent}>
                      <Text style={[styles.bulletLabel, { color: colors.textPrimary }]}>{b.label}</Text>
                      <View style={styles.bulletDetailRow}>
                        <Ionicons name={b.icon} size={12} color={colors.textSecondary} />
                        <Text style={[styles.bulletDetail, { color: colors.textSecondary }]}>{b.detail}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {step.footer && (
              <Text style={[styles.tooltipFooterText, { color: colors.textSecondary }]}>
                {step.footer}
              </Text>
            )}

            <View style={styles.tooltipFooter}>
              <Text style={[styles.stepCounter, { color: colors.textSecondary }]}>
                {currentStep + 1} of {steps.length}
              </Text>
              <TouchableOpacity
                onPress={handleNext}
                style={[styles.nextButton, { backgroundColor: colors.brandPrimary }]}
                activeOpacity={0.8}
              >
                <Text style={styles.nextText}>
                  {isLastStep ? 'Done' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Step dots */}
            <View style={styles.stepDots}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        i === currentStep
                          ? colors.brandPrimary
                          : i < currentStep
                            ? colors.brandPrimary + '60'
                            : colors.border,
                    },
                    i === currentStep && styles.stepDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  spotlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    zIndex: 10,
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2,
    zIndex: 9,
  },
  tooltipContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 20,
    alignItems: 'center',
  },
  tooltipCentered: {
    top: '35%',
  },
  tooltip: {
    borderRadius: 20,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  tooltipHeaderCentered: {
    alignItems: 'center',
  },
  tooltipIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipTextGroup: {
    flex: 1,
    gap: 3,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  tooltipDescription: {
    fontSize: 13.5,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  tooltipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '500',
  },
  nextButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  nextText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepDotActive: {
    width: 18,
    borderRadius: 4,
  },
  bulletList: {
    gap: 10,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bulletBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  bulletContent: {
    flex: 1,
    gap: 1,
  },
  bulletLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  bulletDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulletDetail: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  tooltipFooterText: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    marginBottom: 4,
  },
})
