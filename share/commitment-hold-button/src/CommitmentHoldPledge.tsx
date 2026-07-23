import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { ComponentProps } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import ConfettiCannon from 'react-native-confetti-cannon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type IconName = ComponentProps<typeof Ionicons>['name']

export type CommitmentHoldPledgeProps = {
  name?: string
  pledgeText?: string
  coachMessage?: string
  completeCoachMessage?: string
  coachImage?: ImageSourcePropType
  holdPrompt?: string
  holdingTitle?: string
  holdingSubtitle?: string
  completeTitle?: string
  committedLabel?: string
  continueLabel?: string
  holdDurationMs?: number
  accentColor?: string
  backgroundColor?: string
  surfaceColor?: string
  borderColor?: string
  textColor?: string
  mutedTextColor?: string
  buttonIcon?: IconName
  completeIcon?: IconName
  showConfetti?: boolean
  enableHaptics?: boolean
  style?: StyleProp<ViewStyle>
  footerStyle?: StyleProp<ViewStyle>
  onHoldingChange?: (holding: boolean) => void
  onComplete?: () => void
  onContinue?: () => void
}

const DEFAULT_PLEDGE =
  'commit to showing up, doing the work, and choosing progress over perfection.'

export function CommitmentHoldPledge({
  name = 'User',
  pledgeText = DEFAULT_PLEDGE,
  coachMessage = "Let's make it real.",
  completeCoachMessage = 'That is how you take charge.',
  coachImage,
  holdPrompt = 'Tap and hold to commit.',
  holdingTitle = 'Keep holding!',
  holdingSubtitle = 'Commitment takes discipline.',
  completeTitle = 'You are committed!',
  committedLabel = 'Committed',
  continueLabel = 'Continue',
  holdDurationMs = 3000,
  accentColor = '#F97316',
  backgroundColor = '#0B0B0D',
  surfaceColor = '#17171A',
  borderColor = 'rgba(255,255,255,0.12)',
  textColor = '#FFFFFF',
  mutedTextColor = 'rgba(255,255,255,0.68)',
  buttonIcon = 'flash',
  completeIcon = 'checkmark',
  showConfetti = true,
  enableHaptics = true,
  style,
  footerStyle,
  onHoldingChange,
  onComplete,
  onContinue,
}: CommitmentHoldPledgeProps) {
  const insets = useSafeAreaInsets()
  const [holding, setHolding] = useState(false)
  const [committed, setCommitted] = useState(false)
  const [showContinue, setShowContinue] = useState(false)

  const progress = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const wave = useRef(new Animated.Value(0)).current
  const confettiRef = useRef<ConfettiCannon | null>(null)

  const screenHeight = Dimensions.get('window').height

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )

    loop.start()
    return () => loop.stop()
  }, [wave])

  useEffect(() => {
    if (!committed) return

    const timer = setTimeout(() => setShowContinue(true), 700)
    return () => clearTimeout(timer)
  }, [committed])

  const riseTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, -100],
  })

  const textTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenHeight, 100],
  })

  const spin = wave.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const confettiColors = useMemo(
    () => [accentColor, '#FFD166', '#06D6A0', '#118AB2', '#EF476F', '#FFFFFF'],
    [accentColor],
  )

  const setHoldingState = (nextHolding: boolean) => {
    setHolding(nextHolding)
    onHoldingChange?.(nextHolding)
  }

  const finishCommitment = () => {
    if (enableHaptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      )
    }

    setCommitted(true)
    setHoldingState(false)
    onComplete?.()
    confettiRef.current?.start()
  }

  const handlePressIn = (_event: GestureResponderEvent) => {
    if (committed) return

    setHoldingState(true)
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start()

    Animated.timing(progress, {
      toValue: 1,
      duration: holdDurationMs,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) finishCommitment()
    })
  }

  const handlePressOut = (_event: GestureResponderEvent) => {
    if (committed) return

    setHoldingState(false)
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start()

    progress.stopAnimation((currentValue: number) => {
      Animated.timing(progress, {
        toValue: 0,
        duration: Math.max(currentValue * holdDurationMs * 0.5, 300),
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start()
    })
  }

  const coachBubble = committed ? completeCoachMessage : coachMessage

  return (
    <View style={[styles.root, { backgroundColor }, style]}>
      {showConfetti ? (
        <ConfettiCannon
          ref={confettiRef}
          count={140}
          origin={{ x: Dimensions.get('window').width / 2, y: -20 }}
          autoStart={false}
          fadeOut
          explosionSpeed={350}
          fallSpeed={3000}
          colors={confettiColors}
        />
      ) : null}

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ translateY: riseTranslateY }],
            },
          ]}
        >
          <View
            style={[
              styles.fillBody,
              { height: screenHeight * 2, backgroundColor: accentColor },
            ]}
          />
          <Animated.View
            style={[
              styles.waveOne,
              { backgroundColor: accentColor, transform: [{ rotate: spin }] },
            ]}
          />
          <Animated.View
            style={[
              styles.waveTwo,
              { backgroundColor: accentColor, transform: [{ rotate: spin }] },
            ]}
          />
        </Animated.View>

        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ translateY: riseTranslateY }],
              overflow: 'hidden',
            },
          ]}
        >
          <Animated.View
            style={[
              styles.revealCopyFrame,
              {
                height: screenHeight,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            <View style={styles.revealCopyInner}>
              {committed ? (
                <Animated.View
                  style={[styles.successHalo, { transform: [{ scale }] }]}
                >
                  <View style={styles.successIconWrap}>
                    <Ionicons name={completeIcon} size={64} color="#FFFFFF" />
                  </View>
                </Animated.View>
              ) : null}
              <Text style={styles.revealTitle}>
                {committed ? completeTitle : holdingTitle}
              </Text>
              {!committed ? (
                <Text style={styles.revealSubtitle}>{holdingSubtitle}</Text>
              ) : null}
            </View>
          </Animated.View>
        </Animated.View>
      </View>

      <View
        style={[
          styles.content,
          {
            paddingTop: 52 + insets.top,
            paddingBottom: Math.max(insets.bottom, 20) + 10,
          },
        ]}
      >
        <View>
          <Animated.View
            style={[
              styles.coachRow,
              {
                opacity: holding ? 0 : 1,
              },
            ]}
          >
            {coachImage ? (
              <Image source={coachImage} style={styles.coachImage} />
            ) : (
              <View style={[styles.coachImageFallback, { borderColor }]}>
                <Ionicons name="sparkles" size={22} color={accentColor} />
              </View>
            )}
            <View
              style={[
                styles.coachBubble,
                { backgroundColor: surfaceColor, borderColor },
              ]}
            >
              <Text style={[styles.coachText, { color: textColor }]}>
                {coachBubble}
              </Text>
            </View>
          </Animated.View>

          {!committed && !holding ? (
            <View style={styles.pledgeBlock}>
              <Text style={[styles.pledgeTitle, { color: textColor }]}>
                I, {name},
              </Text>
              <Text style={[styles.pledgeText, { color: textColor }]}>
                {pledgeText}
              </Text>
            </View>
          ) : null}

          {committed ? (
            <Animated.View style={styles.badgeWrap}>
              <View style={[styles.badge, { backgroundColor: accentColor }]}>
                <Text style={styles.badgeText}>{committedLabel}</Text>
                <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
              </View>
            </Animated.View>
          ) : null}
        </View>

        <View style={[styles.footer, footerStyle]}>
          {!committed ? (
            <View style={styles.holdArea}>
              <Animated.View style={{ transform: [{ scale }] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={holdPrompt}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  style={({ pressed }) => [
                    styles.holdButton,
                    {
                      backgroundColor: accentColor,
                      borderColor: textColor as ColorValue,
                      shadowColor: accentColor,
                      opacity: pressed ? 0.98 : 1,
                    },
                  ]}
                >
                  <Ionicons name={buttonIcon} size={56} color="#FFFFFF" />
                </Pressable>
              </Animated.View>
              <Text
                style={[
                  styles.holdPrompt,
                  { color: holding ? 'transparent' : mutedTextColor },
                ]}
              >
                {holdPrompt}
              </Text>
            </View>
          ) : null}

          {committed && showContinue ? (
            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
              style={({ pressed }) => [
                styles.continueButton,
                { opacity: pressed ? 0.84 : 1 },
              ]}
            >
              <Text style={[styles.continueText, { color: accentColor }]}>
                {continueLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  fillBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  waveOne: {
    position: 'absolute',
    top: -300,
    left: '-50%',
    width: 1000,
    height: 1000,
    borderRadius: 420,
  },
  waveTwo: {
    position: 'absolute',
    top: -320,
    right: '-40%',
    width: 900,
    height: 900,
    borderRadius: 400,
  },
  revealCopyFrame: {
    position: 'absolute',
    top: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealCopyInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successHalo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  successIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revealTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  revealSubtitle: {
    color: '#FFFFFF',
    fontSize: 18,
    opacity: 0.85,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  coachImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  coachImageFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  coachBubble: {
    maxWidth: 260,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  coachText: {
    fontSize: 16,
    lineHeight: 22,
  },
  pledgeBlock: {
    marginTop: 24,
    paddingHorizontal: 4,
  },
  pledgeTitle: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 41,
  },
  pledgeText: {
    fontSize: 20,
    lineHeight: 32,
    fontWeight: '500',
    marginTop: 8,
  },
  badgeWrap: {
    marginTop: 40,
    alignSelf: 'flex-start',
  },
  badge: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    zIndex: 50,
    elevation: 50,
  },
  holdArea: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 60,
  },
  holdButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginBottom: 24,
    borderWidth: 6,
  },
  holdPrompt: {
    fontSize: 18,
    fontWeight: '700',
  },
  continueButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '800',
  },
})
