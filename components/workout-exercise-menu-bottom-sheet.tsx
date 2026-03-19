import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface WorkoutExerciseMenuBottomSheetProps {
  visible: boolean
  onClose: () => void
  onReorder: () => void
  onReplace: () => void
  onRemove: () => void
}

export function WorkoutExerciseMenuBottomSheet({
  visible,
  onClose,
  onReorder,
  onReplace,
  onRemove,
}: WorkoutExerciseMenuBottomSheetProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors, isDark)

  const translateY = useSharedValue(400)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      })
      backdropOpacity.value = withTiming(1, { duration: 200 })
    } else {
      translateY.value = withTiming(400, {
        duration: 200,
        easing: Easing.in(Easing.quad),
      })
      backdropOpacity.value = withTiming(0, { duration: 150 })
    }
  }, [visible, translateY, backdropOpacity])

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
          <Pressable style={styles.backdropPress} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetWrapper,
            { paddingBottom: Math.max(insets.bottom + 12, 24) },
            animatedSheetStyle,
          ]}
        >
          <LiquidGlassSurface
            style={styles.sheet}
            glassEffectStyle="regular"
            fallbackStyle={styles.sheetFallback}
          >
            <View style={styles.handleBar} />

            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose()
                  onReorder()
                }}
              >
                <Ionicons name="swap-vertical" size={24} color={colors.textPrimary} />
                <Text style={styles.menuItemText}>Reorder Exercises</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose()
                  onReplace()
                }}
              >
                <Ionicons name="refresh" size={24} color={colors.textPrimary} />
                <Text style={styles.menuItemText}>Replace Exercise</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose()
                  onRemove()
                }}
              >
                <Ionicons name="close" size={24} color={colors.statusError} />
                <Text style={[styles.menuItemText, { color: colors.statusError }]}>
                  Remove Exercise
                </Text>
              </TouchableOpacity>
            </View>
          </LiquidGlassSurface>
        </Animated.View>
      </View>
    </Modal>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(8, 10, 20, 0.28)',
    },
    backdropPress: {
      flex: 1,
    },
    sheetWrapper: {
      paddingHorizontal: 10,
    },
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 10,
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255, 255, 255, 0.14)'
        : 'rgba(255, 255, 255, 0.56)',
      shadowColor: '#000000',
      shadowOpacity: isDark ? 0.28 : 0.14,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: -8 },
    },
    sheetFallback: {
      backgroundColor: isDark
        ? 'rgba(24, 24, 28, 0.95)'
        : 'rgba(248, 249, 255, 0.95)',
    },
    handleBar: {
      width: 42,
      height: 4,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.34)'
        : 'rgba(39, 44, 63, 0.24)',
      borderRadius: 999,
      alignSelf: 'center',
      marginBottom: 14,
    },
    menuContainer: {
      paddingBottom: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 8,
      gap: 16,
    },
    menuItemText: {
      fontSize: 17,
      color: colors.textPrimary,
      fontWeight: '400',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 8,
    },
  })
