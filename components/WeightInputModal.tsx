import { useUnit, type WeightUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'

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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setWeightUnit(unit)
  }

  const handleSave = async () => {
    if (!hasValidWeight || weightKg === null) {
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setWeightInput('')
    onClose()
  }

  const styles = createStyles(colors)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Log Weight</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Unit Toggle */}
            <View style={styles.unitToggle}>
              {WEIGHT_UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.unitButton,
                    weightUnit === unit && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => handleWeightUnitToggle(unit)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      weightUnit === unit && { color: colors.white },
                    ]}
                  >
                    {unit.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Weight Input */}
            <View style={styles.inputSection}>
              <TextInput
                style={[
                  styles.input,
                  weightError && { borderColor: colors.error },
                ]}
                value={weightInput}
                onChangeText={handleWeightChange}
                placeholder={weightUnit === 'kg' ? 'e.g. 72.5' : 'e.g. 160.0'}
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                autoFocus
              />
            </View>

            {weightError && (
              <Text style={styles.errorText}>
                Enter a realistic weight (20-500 kg equivalent)
              </Text>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: hasValidWeight
                    ? colors.primary
                    : colors.backgroundLight,
                },
              ]}
              onPress={handleSave}
              disabled={!hasValidWeight || isSaving}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  {
                    color: hasValidWeight ? colors.white : colors.textSecondary,
                  },
                ]}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

type Colors = ReturnType<typeof useThemedColors>

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    modalContainer: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.background,
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 24,
      elevation: 8,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      gap: 16,
    },
    unitToggle: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'center',
    },
    unitButton: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      minWidth: 80,
      alignItems: 'center',
    },
    unitButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
    },
    inputSection: {
      gap: 12,
    },
    input: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 13,
      color: colors.error,
      textAlign: 'center',
    },
    previewText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
    },
    footer: {
      padding: 20,
      paddingTop: 0,
    },
    saveButton: {
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    saveButtonText: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
  })
