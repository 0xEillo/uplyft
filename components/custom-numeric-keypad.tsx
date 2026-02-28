import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { BlurView } from 'expo-blur'
import React, { useEffect, useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type KeypadInputField = 'weight' | 'reps'
type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'dot'
  | 'backspace'

export interface CustomNumericKeypadProps {
  field: KeypadInputField
  onKeyPress: (key: KeypadKey) => void
  onNext: () => void
  onDone: () => void
  onReady?: () => void
}

const NUMBER_ROWS: (KeypadKey | null)[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['dot', '0', 'backspace'],
]

export function CustomNumericKeypad({
  field,
  onKeyPress,
  onNext,
  onDone,
  onReady,
}: CustomNumericKeypadProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors, isDark)
  const isWeightField = field === 'weight'
  const [buttonsReady, setButtonsReady] = useState(false)
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current)
        readyTimeoutRef.current = null
      }
    }
  }, [field])

  useEffect(() => {
    setButtonsReady(false)
    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current)
    }
    readyTimeoutRef.current = setTimeout(() => {
      readyTimeoutRef.current = null
      setButtonsReady(true)
    }, 180)

    return () => {
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current)
        readyTimeoutRef.current = null
      }
    }
  }, [field])

  const handleDone = () => {
    if (!buttonsReady) return
    onDone()
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={handleDone}
      onShow={() => onReady?.()}
      presentationStyle="overFullScreen"
      hardwareAccelerated
      statusBarTranslucent
    >
      <View style={styles.wrapper} pointerEvents="box-none">
        <Pressable
          style={[
            styles.dismissArea,
            isDark ? styles.dismissAreaDark : styles.dismissAreaLight,
          ]}
          onPress={() => {
            if (!buttonsReady) return
            handleDone()
          }}
          accessibilityLabel="Dismiss keypad"
        />

        <View
          style={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 10) + 6 },
          ]}
        >
          <BlurView
            pointerEvents="none"
            intensity={isDark ? 46 : 58}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.blurFallback} />

          <View style={styles.headerRow}>
            <Text style={styles.headerLabel}>
              {isWeightField ? 'Weight' : 'Reps'}
            </Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleDone}
              activeOpacity={0.8}
              disabled={!buttonsReady}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.keypadRow}>
            <View style={styles.leftGrid}>
              {NUMBER_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.numberRow}>
                  {row.map((key, keyIndex) => {
                    const isDotDisabled = key === 'dot' && !isWeightField
                    if (!key) {
                      return <View key={keyIndex} style={styles.keySpacer} />
                    }

                    const label =
                      key === 'backspace'
                        ? '⌫'
                        : key === 'dot'
                          ? '.'
                          : key

                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.keyButton,
                          isDotDisabled && styles.keyButtonDisabled,
                        ]}
                        disabled={isDotDisabled || !buttonsReady}
                        onPress={() => {
                          if (!buttonsReady) return
                          onKeyPress(key)
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.keyButtonText}>{label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => {
                if (!buttonsReady) return
                onNext()
              }}
              activeOpacity={0.85}
              disabled={!buttonsReady}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      top: 0,
      justifyContent: 'flex-end',
    },
    dismissArea: {
      flex: 1,
    },
    dismissAreaLight: {
      backgroundColor: 'rgba(16, 24, 40, 0.08)',
    },
    dismissAreaDark: {
      backgroundColor: 'rgba(0, 0, 0, 0.16)',
    },
    container: {
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: 'transparent',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(255, 255, 255, 0.88)',
      paddingHorizontal: 12,
      paddingTop: 8,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: isDark ? 0.28 : 0.14,
      shadowRadius: 20,
      elevation: 20,
    },
    blurFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.04)'
        : 'rgba(255, 255, 255, 0.2)',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      zIndex: 1,
    },
    headerLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    doneButton: {
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    doneButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    keypadRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      zIndex: 1,
    },
    leftGrid: {
      flex: 1,
      gap: 8,
    },
    numberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    keySpacer: {
      flex: 1,
    },
    keyButton: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyButtonDisabled: {
      opacity: 0.28,
    },
    keyButtonText: {
      fontSize: 24,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    nextButton: {
      width: 64,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 22,
      backgroundColor: colors.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.35 : 0.22,
      shadowRadius: 8,
      elevation: 3,
    },
    nextButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  })
