import { useUnit, type WeightUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const WEIGHT_UNITS: WeightUnit[] = ['kg', 'lb']

interface WeightInputModalProps {
  visible: boolean
  onClose: () => void
  onSave: (weightKg: number) => void | Promise<void>
  initialValue?: number | null
}

export function WeightInputModal({
  visible,
  onClose,
  onSave,
  initialValue,
}: WeightInputModalProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { weightUnit, setWeightUnit, convertInputToKg } = useUnit()

  const [weightInput, setWeightInput] = useState(
    initialValue !== null && initialValue !== undefined
      ? initialValue.toFixed(1)
      : '',
  )
  const [isSaving, setIsSaving] = useState(false)

  const normalizedWeight = weightInput.replace(',', '.')
  const weightValue =
    normalizedWeight.trim().length === 0
      ? null
      : parseFloat(normalizedWeight)
  const weightKg =
    weightValue !== null && !Number.isNaN(weightValue)
      ? convertInputToKg(weightValue)
      : null
  const hasValidWeight = weightKg !== null && weightKg >= 20 && weightKg <= 500
  const weightError = weightInput.trim().length > 0 && !hasValidWeight

  const handleWeightChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.,]/g, '')
    const normalized = sanitized.replace(/,/g, '.')
    setWeightInput(normalized)
  }

  const handleWeightUnitToggle = async (unit: WeightUnit) => {
    if (weightUnit === unit) return
    haptic('light')
    setWeightUnit(unit)
  }

  const handleSave = async () => {
    if (!hasValidWeight || weightKg === null) {
      return
    }
    haptic('medium')
    setIsSaving(true)

    try {
      await onSave(weightKg)
      setWeightInput('')
      onClose()
    } catch (error) {
      console.error('Error saving weight:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = async () => {
    haptic('light')
    Keyboard.dismiss()
    setWeightInput('')
    onClose()
  }

  const styles = createStyles(colors, insets.bottom)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayTouch} onPress={Keyboard.dismiss}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Log Weight</Text>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View style={styles.unitToggle}>
                {WEIGHT_UNITS.map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[
                      styles.unitButton,
                      {
                        backgroundColor:
                          weightUnit === unit ? colors.textPrimary : colors.surfaceSubtle,
                        borderColor: weightUnit === unit ? colors.textPrimary : colors.border,
                      },
                    ]}
                    onPress={() => handleWeightUnitToggle(unit)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.unitButtonText,
                        {
                          color: weightUnit === unit ? colors.bg : colors.textSecondary,
                        },
                      ]}
                    >
                      {unit.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: weightError ? colors.statusError : colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={weightInput}
                  onChangeText={handleWeightChange}
                  placeholder={weightUnit === 'kg' ? '72.5' : '160'}
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  onSubmitEditing={handleSave}
                  returnKeyType="none"
                  autoFocus
                />
                <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>
                  {weightUnit}
                </Text>
              </View>

              {weightError && (
                <Text style={[styles.errorText, { color: colors.statusError }]}>
                  Enter a realistic weight (20–500 kg equivalent)
                </Text>
              )}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: hasValidWeight ? colors.textPrimary : colors.surfaceSubtle,
                  },
                  { opacity: isSaving ? 0.7 : 1 },
                ]}
                onPress={handleSave}
                disabled={!hasValidWeight || isSaving}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.saveButtonText,
                    {
                      color: hasValidWeight ? colors.bg : colors.textTertiary,
                    },
                  ]}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

type Colors = ReturnType<typeof useThemedColors>

const createStyles = (colors: Colors, bottomInset: number) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlayTouch: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    modalContainer: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surfaceSheet,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: Math.max(bottomInset, 20),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    closeBtn: {
      padding: 4,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 14,
    },
    unitToggle: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
    },
    unitButton: {
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      minWidth: 72,
      alignItems: 'center',
    },
    unitButtonText: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 20,
      minHeight: 56,
    },
    input: {
      flex: 1,
      fontSize: 28,
      fontWeight: '700',
      paddingVertical: 14,
      letterSpacing: -0.6,
      textAlign: 'center',
    },
    unitLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    errorText: {
      fontSize: 13,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    saveButton: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
    },
    saveButtonText: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
  })
