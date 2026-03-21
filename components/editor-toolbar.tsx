import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  DEFAULT_TOOLBAR_BUTTONS,
  type ToolbarButtonId,
} from '@/lib/utils/create-post-settings'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
    Animated,
    Dimensions,
    Easing,
    Keyboard,
    LayoutAnimation,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface EditorToolbarProps {
  onScanWorkout: () => void
  onMicPress: () => void
  onStopwatchPress: () => void
  onRoutinePress: () => void
  onAddExercise: () => void
  isRecording: boolean
  isTranscribing: boolean
  isProcessingImage: boolean
  isLoading: boolean
  isRestTimerActive?: boolean
  restTimerRemaining?: number
  scanButtonRef?: RefObject<View | null>
  micButtonRef?: RefObject<View | null>
  timerButtonRef?: RefObject<View | null>
  routineButtonRef?: RefObject<View | null>
  addButtonRef?: RefObject<View | null>
  bottomInsetOverride?: number
  accessoryMode?: boolean
  visibleButtons?: ToolbarButtonId[]
  presentationMode?: 'default' | 'force-add' | 'force-tools'
}

type SecondaryToolbarButton = {
  id: Exclude<ToolbarButtonId, 'search'>
  ref?: RefObject<View | null>
  onPress: () => void
  active: boolean
  renderContent: () => ReactNode
}

function ToolbarPlusIcon({
  size,
  color,
}: {
  size: number
  color: string
}) {
  const barThickness = Math.max(2, size * 0.12)
  const armLength = size * 0.72

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: armLength,
          height: barThickness,
          borderRadius: barThickness / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: barThickness,
          height: armLength,
          borderRadius: barThickness / 2,
          backgroundColor: color,
        }}
      />
    </View>
  )
}

export function EditorToolbar({
  onScanWorkout,
  onMicPress,
  onStopwatchPress,
  onRoutinePress,
  onAddExercise,
  isRecording,
  isTranscribing,
  isProcessingImage,
  isLoading,
  isRestTimerActive,
  restTimerRemaining,
  scanButtonRef,
  micButtonRef,
  timerButtonRef,
  routineButtonRef,
  addButtonRef,
  bottomInsetOverride,
  accessoryMode = false,
  visibleButtons = DEFAULT_TOOLBAR_BUTTONS,
  presentationMode = 'default',
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

  const isProcessing = isProcessingImage || isTranscribing

  useEffect(() => {
    if (isProcessing) {
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
  }, [isProcessing, spinValue])

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
  const show = (id: ToolbarButtonId) => visibleButtons.includes(id)
  const [isToolsExpandedLocal, setIsToolsExpandedLocal] = useState(false)
  const addButtonProgress = useRef(new Animated.Value(0)).current
  const screenWidth = Dimensions.get('window').width

  const secondaryButtons: SecondaryToolbarButton[] = []

  if (show('workout-scan')) {
    secondaryButtons.push({
      id: 'workout-scan',
      ref: scanButtonRef,
      onPress: onScanWorkout,
      active: isProcessingImage,
      renderContent: () =>
        isProcessingImage ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync" size={isIOS ? 23 : 24} color={colors.surface} />
          </Animated.View>
        ) : (
          <Ionicons
            name="camera-outline"
            size={isIOS ? 23 : 24}
            color={colors.textPrimary}
          />
        ),
    })
  }

  if (show('voice-log')) {
    secondaryButtons.push({
      id: 'voice-log',
      ref: micButtonRef,
      onPress: onMicPress,
      active: isRecording || isTranscribing,
      renderContent: () =>
        isTranscribing ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync" size={isIOS ? 23 : 24} color={colors.surface} />
          </Animated.View>
        ) : (
          <Ionicons
            name={isRecording ? 'stop' : 'mic-outline'}
            size={isIOS ? 23 : 24}
            color={isRecording ? colors.surface : colors.textPrimary}
          />
        ),
    })
  }

  if (show('rest-timer')) {
    secondaryButtons.push({
      id: 'rest-timer',
      ref: timerButtonRef,
      onPress: onStopwatchPress,
      active: Boolean(isRestTimerActive),
      renderContent: () =>
        isRestTimerActive && restTimerRemaining !== undefined ? (
          <Text style={styles.timerText}>
            {formatTime(restTimerRemaining)}
          </Text>
        ) : (
          <Ionicons
            name="stopwatch-outline"
            size={isIOS ? 23 : 24}
            color={colors.textPrimary}
          />
        ),
    })
  }

  if (show('routines')) {
    secondaryButtons.push({
      id: 'routines',
      ref: routineButtonRef,
      onPress: onRoutinePress,
      active: false,
      renderContent: () => (
        <Ionicons
          name="albums-outline"
          size={isIOS ? 23 : 24}
          color={colors.textPrimary}
        />
      ),
    })
  }

  const singleSecondaryButton =
    secondaryButtons.length === 1 ? secondaryButtons[0] : null
  const hasSecondaryButtons = secondaryButtons.length > 0
  const hasExpandableSecondaryButtons = secondaryButtons.length > 1
  const showAddButton = show('search')
  const isToolsExpanded =
    hasExpandableSecondaryButtons &&
    (presentationMode === 'force-tools' ||
      (presentationMode === 'default' && isToolsExpandedLocal))

  useEffect(() => {
    Animated.timing(addButtonProgress, {
      toValue: isToolsExpanded ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: false,
    }).start()
  }, [addButtonProgress, isToolsExpanded])

  const animateToolbarLayout = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    )
  }, [])

  const handleToggleTools = useCallback(() => {
    if (presentationMode !== 'default' || !hasSecondaryButtons || isDisabled) {
      return
    }

    animateToolbarLayout()
    setIsToolsExpandedLocal((current) => !current)
  }, [animateToolbarLayout, hasSecondaryButtons, isDisabled, presentationMode])

  const handleToolAction = useCallback(
    (action: () => void) => {
      if (presentationMode === 'default') {
        animateToolbarLayout()
        setIsToolsExpandedLocal(false)
      }
      action()
    },
    [animateToolbarLayout, presentationMode],
  )

  const handleCloseTools = useCallback(() => {
    if (presentationMode !== 'default') return
    animateToolbarLayout()
    setIsToolsExpandedLocal(false)
  }, [animateToolbarLayout, presentationMode])

  const handleAddButtonPress = useCallback(() => {
    if (presentationMode === 'default' && isToolsExpandedLocal) {
      animateToolbarLayout()
      setIsToolsExpandedLocal(false)
    }
    onAddExercise()
  }, [animateToolbarLayout, isToolsExpandedLocal, onAddExercise, presentationMode])

  const addButtonWidth = addButtonProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [
      Math.max(
        isIOS
          ? screenWidth - 24 - (hasSecondaryButtons ? 46 + 10 : 0)
          : screenWidth - 32 - (hasSecondaryButtons ? 40 + 12 : 0),
        isIOS ? 180 : 200,
      ),
      isIOS ? 46 : 48,
    ],
  })
  const MAX_SECONDARY_TOOL_BUTTONS = 4
  const expandedToolButtonCount = secondaryButtons.length + 1
  const availableExpandedToolsWidth = Math.max(
    0,
    isIOS
      ? screenWidth - 24 - (showAddButton ? 46 + 10 : 0)
      : screenWidth - 32 - (showAddButton ? 48 + 12 : 0),
  )
  const minimumExpandedGap = isIOS ? 10 : 12
  const minimumExpandedToolsWidth = isIOS
    ? 34 +
      secondaryButtons.length * 44 +
      Math.max(0, expandedToolButtonCount - 1) * minimumExpandedGap +
      24
    : expandedToolButtonCount * 40 +
      Math.max(0, expandedToolButtonCount - 1) * minimumExpandedGap
  const toolCoverageRatio =
    secondaryButtons.length > 0
      ? secondaryButtons.length / MAX_SECONDARY_TOOL_BUTTONS
      : 0
  const targetExpandedCoverage =
    secondaryButtons.length > 0
      ? 0.42 + toolCoverageRatio * 0.54
      : 0
  const expandedToolsWidth = Math.min(
    availableExpandedToolsWidth,
    Math.max(
      minimumExpandedToolsWidth,
      availableExpandedToolsWidth * targetExpandedCoverage,
    ),
  )
  const addLabelOpacity = addButtonProgress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.1, 0],
  })
  const addCtaContentOpacity = addButtonProgress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.08, 0],
  })
  const addCompactIconOpacity = addButtonProgress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0, 1],
  })
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
          {hasSecondaryButtons &&
            (singleSecondaryButton ? (
              <LiquidGlassSurface style={styles.iosSingleToolGlass}>
                <View ref={singleSecondaryButton.ref} collapsable={false}>
                  <TouchableOpacity
                    style={[
                      styles.iosSingleToolButton,
                      singleSecondaryButton.active && styles.activeButton,
                      singleSecondaryButton.id === 'rest-timer' &&
                        singleSecondaryButton.active &&
                        styles.activeTimerButton,
                    ]}
                    onPress={() => singleSecondaryButton.onPress()}
                    disabled={isDisabled}
                  >
                    {singleSecondaryButton.renderContent()}
                  </TouchableOpacity>
                </View>
              </LiquidGlassSurface>
            ) : (
              <LiquidGlassSurface
                style={[
                  isToolsExpanded
                    ? styles.iosToolbarGlass
                    : styles.iosToolsCollapsedGlass,
                  isToolsExpanded && { width: expandedToolsWidth },
                ]}
              >
                {isToolsExpanded ? (
                  <View style={styles.iosToolbarExpanded}>
                    <TouchableOpacity
                      style={styles.iosToolsCloseButton}
                      onPress={handleCloseTools}
                      disabled={isDisabled}
                    >
                      <Ionicons
                        name="close-outline"
                        size={20}
                        color={colors.textPrimary}
                      />
                    </TouchableOpacity>
                    {secondaryButtons.map((button) => (
                      <View key={button.id} ref={button.ref} collapsable={false}>
                        <TouchableOpacity
                          style={[
                            styles.iosButton,
                            button.active && styles.activeButton,
                            button.id === 'rest-timer' &&
                              button.active &&
                              styles.activeTimerButton,
                          ]}
                          onPress={() => handleToolAction(button.onPress)}
                          disabled={isDisabled}
                        >
                          {button.renderContent()}
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.iosToolsCollapsedButton}
                    onPress={handleToggleTools}
                    disabled={isDisabled}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={18}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
                )}
              </LiquidGlassSurface>
            ))}

          {showAddButton && (
            <View
              ref={addButtonRef}
              collapsable={false}
              style={styles.iosAddWrap}
            >
              <Animated.View style={[styles.addButtonShell, { width: addButtonWidth }]}>
                <LiquidGlassSurface style={styles.iosAddGlass}>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddButtonPress}
                    disabled={isDisabled}
                    activeOpacity={0.85}
                  >
                    <View style={styles.addButtonContentFrame}>
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.addButtonCompactIconLayer,
                          { opacity: addCompactIconOpacity },
                        ]}
                      >
                        <ToolbarPlusIcon
                          size={18}
                          color={colors.textPrimary}
                        />
                      </Animated.View>
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.addButtonCtaLayer,
                          { opacity: addCtaContentOpacity },
                        ]}
                      >
                        <ToolbarPlusIcon
                          size={18}
                          color={colors.textPrimary}
                        />
                        <Animated.Text
                          numberOfLines={1}
                          style={[
                            styles.addButtonLabel,
                            {
                              color: colors.textPrimary,
                              opacity: addLabelOpacity,
                            },
                          ]}
                        >
                          Add exercise
                        </Animated.Text>
                      </Animated.View>
                    </View>
                  </TouchableOpacity>
                </LiquidGlassSurface>
              </Animated.View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.toolbar}>
          {hasSecondaryButtons && (
            <View style={styles.androidToolsWrap}>
              {singleSecondaryButton ? (
                <View ref={singleSecondaryButton.ref} collapsable={false}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      singleSecondaryButton.active && styles.activeButton,
                      singleSecondaryButton.id === 'rest-timer' &&
                        singleSecondaryButton.active &&
                        styles.activeTimerButton,
                    ]}
                    onPress={() => singleSecondaryButton.onPress()}
                    disabled={isDisabled}
                  >
                    {singleSecondaryButton.renderContent()}
                  </TouchableOpacity>
                </View>
              ) : isToolsExpanded ? (
                <View
                  style={[
                    styles.androidToolsExpanded,
                    { width: expandedToolsWidth },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleCloseTools}
                    disabled={isDisabled}
                  >
                    <Ionicons
                      name="close-outline"
                      size={20}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
                  {secondaryButtons.map((button) => (
                    <View key={button.id} ref={button.ref} collapsable={false}>
                      <TouchableOpacity
                        style={[
                          styles.button,
                          button.active && styles.activeButton,
                          button.id === 'rest-timer' &&
                            button.active &&
                            styles.activeTimerButton,
                        ]}
                        onPress={() => handleToolAction(button.onPress)}
                        disabled={isDisabled}
                      >
                        {button.renderContent()}
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleToggleTools}
                  disabled={isDisabled}
                >
                  <Ionicons
                    name="ellipsis-vertical"
                    size={20}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {showAddButton && (
            <View ref={addButtonRef} collapsable={false} style={styles.androidAddWrap}>
              <Animated.View style={[styles.addButtonShell, { width: addButtonWidth }]}>
                <TouchableOpacity
                  style={styles.androidAddButton}
                  onPress={handleAddButtonPress}
                  disabled={isDisabled}
                  activeOpacity={0.85}
                >
                  <View style={styles.addButtonContentFrame}>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.addButtonCompactIconLayer,
                        { opacity: addCompactIconOpacity },
                      ]}
                    >
                      <ToolbarPlusIcon
                        size={18}
                        color={colors.textPrimary}
                      />
                    </Animated.View>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.addButtonCtaLayer,
                        { opacity: addCtaContentOpacity },
                      ]}
                    >
                      <ToolbarPlusIcon
                        size={18}
                        color={colors.textPrimary}
                      />
                      <Animated.Text
                        numberOfLines={1}
                        style={[
                          styles.addButtonLabel,
                          {
                            color: colors.textPrimary,
                            opacity: addLabelOpacity,
                          },
                        ]}
                      >
                        Add exercise
                      </Animated.Text>
                    </Animated.View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
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
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      height: 50,
      gap: 12,
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
      width: '100%',
    },
    iosToolsCollapsedGlass: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderColor: 'rgba(255,255,255,0.12)',
      borderWidth: StyleSheet.hairlineWidth,
    },
    iosSingleToolGlass: {
      minWidth: 46,
      height: 46,
      borderRadius: 23,
      borderColor: 'rgba(255,255,255,0.12)',
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    iosToolbarGlass: {
      borderRadius: 28,
      borderColor: 'rgba(255,255,255,0.12)',
      borderWidth: StyleSheet.hairlineWidth,
    },
    iosToolbarExpanded: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 46,
      paddingHorizontal: 12,
      paddingVertical: 2,
    },
    iosToolsCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iosToolsCollapsedButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iosSingleToolButton: {
      minWidth: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
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
      height: 46,
      borderRadius: 23,
      borderColor: 'rgba(255,255,255,0.12)',
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    iosAddWrap: {
      marginLeft: 'auto',
    },
    addButtonShell: {
      overflow: 'hidden',
      maxWidth: '100%',
    },
    addButton: {
      height: 46,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 14,
      overflow: 'hidden',
    },
    androidAddWrap: {
      marginLeft: 'auto',
      alignItems: 'stretch',
    },
    androidAddButton: {
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    addButtonContentFrame: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    addButtonCompactIconLayer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButtonCtaLayer: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
    },
    addButtonLabel: {
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    androidToolsWrap: {
      minWidth: 40,
    },
    androidToolsExpanded: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
