import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState, type RefObject } from 'react'
import {
    Animated,
    Easing,
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface EditorToolbarProps {
  onScanWorkout: () => void
  onMicPress: () => void
  onStopwatchPress: () => void
  onRoutinePress: () => void
  onSearchExercise: () => void
  onAddExercise: () => void
  isRecording: boolean
  isTranscribing: boolean
  isProcessingImage: boolean
  isLoading: boolean
  showAddExercise: boolean
  isRestTimerActive?: boolean
  restTimerRemaining?: number
  scanButtonRef?: RefObject<View>
  micButtonRef?: RefObject<View>
  timerButtonRef?: RefObject<View>
  routineButtonRef?: RefObject<View>
  searchButtonRef?: RefObject<View>
  bottomInsetOverride?: number
  accessoryMode?: boolean
}

export function EditorToolbar({
  onScanWorkout,
  onMicPress,
  onStopwatchPress,
  onRoutinePress,
  onSearchExercise,
  onAddExercise,
  isRecording,
  isTranscribing,
  isProcessingImage,
  isLoading,
  showAddExercise,
  isRestTimerActive,
  restTimerRemaining,
  scanButtonRef,
  micButtonRef,
  timerButtonRef,
  routineButtonRef,
  searchButtonRef,
  bottomInsetOverride,
  accessoryMode = false,
}: EditorToolbarProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const isIOS = Platform.OS === 'ios'
  const isIOSAccessory = isIOS && accessoryMode
  const iOSFloatingOffset = isIOSAccessory ? 0 : isIOS ? 4 : 0
  const iOSKeyboardLift = isIOSAccessory ? 0 : isIOS ? 6 : 0
  const bottomInset =
    isIOS
      ? Math.min(bottomInsetOverride ?? insets.bottom, 34)
      : bottomInsetOverride ?? insets.bottom

  // Animation for padding bottom (safe area)
  const paddingBottom = useRef(
    new Animated.Value(isIOSAccessory ? 0 : bottomInset + iOSFloatingOffset),
  ).current

  // Spinning animation for processing state
  const spinValue = useRef(new Animated.Value(0)).current
  const spinAnimation = useRef<Animated.CompositeAnimation | null>(null)
  const spin = useRef(
    spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    }),
  ).current

  useEffect(() => {
    if (isProcessingImage) {
      spinValue.setValue(0)
      spinAnimation.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      )
      spinAnimation.current.start()
    } else {
      spinAnimation.current?.stop()
      spinValue.setValue(0)
    }

    return () => {
      spinAnimation.current?.stop()
    }
  }, [isProcessingImage, spinValue])

  useEffect(() => {
    if (isIOSAccessory) return
    if (!isKeyboardVisible) {
      paddingBottom.setValue(bottomInset + iOSFloatingOffset)
    }
  }, [
    bottomInset,
    isKeyboardVisible,
    paddingBottom,
    isIOSAccessory,
    iOSFloatingOffset,
  ])

  useEffect(() => {
    if (isIOSAccessory) return
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true)

      Animated.timing(paddingBottom, {
        toValue: iOSFloatingOffset + iOSKeyboardLift,
        duration: 250,
        useNativeDriver: false, // Layout animation
      }).start()
    })

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      setIsKeyboardVisible(false)

      Animated.timing(paddingBottom, {
        toValue: bottomInset + iOSFloatingOffset,
        duration: e.duration || 250,
        useNativeDriver: false, // Layout animation
      }).start()
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [
    bottomInset,
    paddingBottom,
    isIOSAccessory,
    iOSFloatingOffset,
    iOSKeyboardLift,
  ])

  const isDisabled = isLoading || isTranscribing || isProcessingImage
  const shouldShowAdd = showAddExercise

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Animated.View
      style={[
        styles.container,
        isIOS && styles.containerIOS,
        { paddingBottom: isIOSAccessory ? 0 : paddingBottom },
      ]}
    >
      {isIOS ? (
        <View style={styles.iosToolbarRow}>
          <LiquidGlassSurface style={styles.iosToolbarGlass}>
            <View style={styles.iosToolbar}>
              {/* Scan Workout */}
              <View ref={scanButtonRef} collapsable={false}>
                <TouchableOpacity
                  style={[
                    styles.iosButton,
                    isProcessingImage && styles.activeButton,
                  ]}
                  onPress={onScanWorkout}
                  disabled={isDisabled}
                >
                  {isProcessingImage ? (
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                      <Ionicons name="sync" size={23} color={colors.surface} />
                    </Animated.View>
                  ) : (
                    <Ionicons
                      name="camera-outline"
                      size={23}
                      color={colors.textPrimary}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {/* Microphone */}
              <View ref={micButtonRef} collapsable={false}>
                <TouchableOpacity
                  style={[styles.iosButton, isRecording && styles.activeButton]}
                  onPress={onMicPress}
                  disabled={isDisabled}
                >
                  <Ionicons
                    name={isRecording ? 'stop' : 'mic-outline'}
                    size={23}
                    color={isRecording ? colors.surface : colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>

              {/* Stopwatch / Timer */}
              <View ref={timerButtonRef} collapsable={false}>
                <TouchableOpacity
                  style={[
                    styles.iosButton,
                    isRestTimerActive && styles.activeTimerButton,
                  ]}
                  onPress={onStopwatchPress}
                  disabled={isDisabled}
                >
                  {isRestTimerActive && restTimerRemaining !== undefined ? (
                    <Text style={styles.timerText}>
                      {formatTime(restTimerRemaining)}
                    </Text>
                  ) : (
                    <Ionicons
                      name="stopwatch-outline"
                      size={23}
                      color={colors.textPrimary}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {/* Routines */}
              <View ref={routineButtonRef} collapsable={false}>
                <TouchableOpacity
                  style={styles.iosButton}
                  onPress={onRoutinePress}
                  disabled={isDisabled}
                >
                  <Ionicons
                    name="albums-outline"
                    size={23}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View ref={searchButtonRef} collapsable={false}>
                <TouchableOpacity
                  style={styles.iosButton}
                  onPress={onSearchExercise}
                  disabled={isDisabled}
                >
                  <Ionicons
                    name="search-outline"
                    size={23}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </LiquidGlassSurface>

          {shouldShowAdd && (
            <LiquidGlassSurface style={styles.iosAddGlass}>
              <TouchableOpacity
                style={[styles.iosAddButton, styles.activeButton]}
                onPress={onAddExercise}
                disabled={isDisabled}
              >
                <Ionicons name="add" size={24} color={colors.surface} />
              </TouchableOpacity>
            </LiquidGlassSurface>
          )}
        </View>
      ) : (
        <View style={styles.toolbar}>
          {/* Scan Workout */}
          <View ref={scanButtonRef} collapsable={false}>
            <TouchableOpacity
              style={[styles.button, isProcessingImage && styles.activeButton]}
              onPress={onScanWorkout}
              disabled={isDisabled}
            >
              {isProcessingImage ? (
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="sync" size={24} color={colors.surface} />
                </Animated.View>
              ) : (
                <Ionicons name="camera-outline" size={24} color={colors.textPrimary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Microphone */}
          <View ref={micButtonRef} collapsable={false}>
            <TouchableOpacity
              style={[styles.button, isRecording && styles.activeButton]}
              onPress={onMicPress}
              disabled={isDisabled}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic-outline'}
                size={24}
                color={isRecording ? colors.surface : colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* Stopwatch / Timer */}
          <View ref={timerButtonRef} collapsable={false}>
            <TouchableOpacity
              style={[styles.button, isRestTimerActive && styles.activeTimerButton]}
              onPress={onStopwatchPress}
              disabled={isDisabled}
            >
              {isRestTimerActive && restTimerRemaining !== undefined ? (
                <Text style={styles.timerText}>
                  {formatTime(restTimerRemaining)}
                </Text>
              ) : (
                <Ionicons name="stopwatch-outline" size={24} color={colors.textPrimary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Routines (moved from title area) */}
          <View ref={routineButtonRef} collapsable={false}>
            <TouchableOpacity
              style={styles.button}
              onPress={onRoutinePress}
              disabled={isDisabled}
            >
              <Ionicons name="albums-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search / Add Exercise (Merged) */}
          <View ref={searchButtonRef} collapsable={false}>
            <TouchableOpacity
              style={styles.button}
              onPress={shouldShowAdd ? onAddExercise : onSearchExercise}
              disabled={isDisabled}
            >
              <Ionicons
                name={shouldShowAdd ? 'add-circle-outline' : 'search-outline'}
                size={24}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.bg, // Match background to blend in
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      zIndex: 1000,
    },
    containerIOS: {
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 0,
    },
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      height: 50,
    },
    button: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 20,
    },
    iosToolbarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iosToolbarGlass: {
      flex: 1,
      borderRadius: 28,
      borderColor: 'rgba(255,255,255,0.12)',
      borderWidth: StyleSheet.hairlineWidth,
    },
    iosToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 46,
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    iosButton: {
      minWidth: 44,
      height: 34,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 18,
      paddingHorizontal: 8,
    },
    iosAddGlass: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    iosAddButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    activeButton: {
      backgroundColor: colors.brandPrimary,
    },
    activeTimerButton: {
      backgroundColor: colors.brandPrimary,
      width: 'auto',
      paddingHorizontal: 12,
    },
    timerText: {
      color: colors.surface,
      fontWeight: '600',
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },
    disabledButton: {
      opacity: 0.5,
    },
  })
