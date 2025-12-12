import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useRef, useState } from 'react'
import {
    Animated,
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface EditorToolbarProps {
  onScanEquipment: () => void
  onMicPress: () => void
  onStopwatchPress: () => void
  onSearchExercise: () => void
  onAddExercise: () => void
  isRecording: boolean
  isTranscribing: boolean
  isProcessingImage: boolean
  isLoading: boolean
  showAddExercise: boolean
  isRestTimerActive?: boolean
  restTimerRemaining?: number
}

export function EditorToolbar({
  onScanEquipment,
  onMicPress,
  onStopwatchPress,
  onSearchExercise,
  onAddExercise,
  isRecording,
  isTranscribing,
  isProcessingImage,
  isLoading,
  showAddExercise,
  isRestTimerActive,
  restTimerRemaining,
}: EditorToolbarProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors, insets)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  
  // Animation for padding bottom (safe area)
  const paddingBottom = useRef(new Animated.Value(insets.bottom)).current

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true)
      setKeyboardHeight(e.endCoordinates.height)
      
      Animated.timing(paddingBottom, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: false, // Layout animation
      }).start()
    })

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      setIsKeyboardVisible(false)
      setKeyboardHeight(0)
      
      Animated.timing(paddingBottom, {
        toValue: insets.bottom,
        duration: e.duration || 250,
        useNativeDriver: false, // Layout animation
      }).start()
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [insets.bottom, paddingBottom])

  const isDisabled = isLoading || isTranscribing || isProcessingImage

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom,
        },
      ]}
    >
      <View style={styles.toolbar}>
        {/* Scan Equipment */}
        <TouchableOpacity
          style={styles.button}
          onPress={onScanEquipment}
          disabled={isDisabled}
        >
          <Ionicons name="barbell-outline" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Microphone */}
        <TouchableOpacity
          style={[styles.button, isRecording && styles.activeButton]}
          onPress={onMicPress}
          disabled={isDisabled}
        >
          <Ionicons 
            name={isRecording ? "stop" : "mic-outline"} 
            size={24} 
            color={isRecording ? colors.white : colors.text} 
          />
        </TouchableOpacity>

        {/* Stopwatch / Timer */}
        <TouchableOpacity
          style={[styles.button, isRestTimerActive && styles.activeTimerButton]}
          onPress={onStopwatchPress}
          disabled={isDisabled}
        >
          {isRestTimerActive && restTimerRemaining !== undefined ? (
            <Text style={styles.timerText}>{formatTime(restTimerRemaining)}</Text>
          ) : (
            <Ionicons name="stopwatch-outline" size={24} color={colors.text} />
          )}
        </TouchableOpacity>

        {/* Search Exercise */}
        <TouchableOpacity
          style={styles.button}
          onPress={onSearchExercise}
          disabled={isDisabled}
        >
          <Ionicons name="search-outline" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Add Exercise (Conditional) */}
        <TouchableOpacity
          style={[styles.button, !showAddExercise && styles.disabledButton]}
          onPress={onAddExercise}
          disabled={isDisabled || !showAddExercise}
        >
          <Ionicons 
            name="add-circle-outline" 
            size={24} 
            color={showAddExercise ? colors.text : colors.textTertiary} 
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: { bottom: number }
) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background, // Match background to blend in
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      zIndex: 1000,
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
    activeButton: {
      backgroundColor: colors.primary,
    },
    activeTimerButton: {
      backgroundColor: colors.primary,
      width: 'auto',
      paddingHorizontal: 12,
    },
    timerText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },
    disabledButton: {
      opacity: 0.5,
    },
  })
