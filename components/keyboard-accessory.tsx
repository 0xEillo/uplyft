import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import {
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native'

interface KeyboardAccessoryBarProps {
  onConvertPress: () => void
  onChooseExercisePress?: () => void
  showConvertButton: boolean
  visible: boolean
}

export function KeyboardAccessoryBar({
  onConvertPress,
  onChooseExercisePress,
  showConvertButton,
  visible,
}: KeyboardAccessoryBarProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const translateY = React.useRef(new Animated.Value(100)).current

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible && keyboardHeight > 0 ? 0 : 100,
      useNativeDriver: true,
      tension: 100,
      friction: 15,
    }).start()
  }, [visible, keyboardHeight, translateY])

  if (!visible || keyboardHeight === 0) {
    return null
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: keyboardHeight,
          transform: [{ translateY }],
        },
      ]}
    >
      {showConvertButton ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onConvertPress}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={20} color={colors.primary} />
          <Text style={styles.actionButtonText}>Add exercise</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onChooseExercisePress}
          activeOpacity={0.7}
        >
          <Ionicons name="search" size={20} color={colors.primary} />
          <Text style={styles.actionButtonText}>Search exercise</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      backgroundColor: 'transparent',
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
  })
