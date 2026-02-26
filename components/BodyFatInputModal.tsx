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

interface BodyFatInputModalProps {
  visible: boolean
  onClose: () => void
  onSave: (bodyFatPercentage: number) => void | Promise<void>
}

export function BodyFatInputModal({ visible, onClose, onSave }: BodyFatInputModalProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const normalized = input.replace(',', '.')
  const value = normalized.trim().length === 0 ? null : parseFloat(normalized)
  const isValid = value !== null && !Number.isNaN(value) && value >= 1 && value <= 60
  const hasError = input.trim().length > 0 && !isValid

  const handleChange = (v: string) => {
    setInput(v.replace(/[^0-9.,]/g, '').replace(/,/g, '.'))
  }

  const handleSave = async () => {
    if (!isValid || value === null) return
    haptic('medium')
    setIsSaving(true)
    try {
      await onSave(value)
      setInput('')
      onClose()
    } catch (e) {
      console.error('Error saving body fat:', e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    haptic('light')
    Keyboard.dismiss()
    setInput('')
    onClose()
  }

  const styles = createStyles(colors, insets.bottom)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayTouch} onPress={Keyboard.dismiss}>
          <Pressable
            style={styles.container}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Log Body Fat</Text>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: hasError ? colors.statusError : colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={input}
                  onChangeText={handleChange}
                  placeholder="15.5"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="decimal-pad"
                onSubmitEditing={handleSave}
                returnKeyType="none"
                autoFocus
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>%</Text>
              </View>

              {hasError && (
                <Text style={[styles.error, { color: colors.statusError }]}>
                  Enter a value between 1% and 60%
                </Text>
              )}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: isValid ? colors.textPrimary : colors.surfaceSubtle,
                  },
                  { opacity: isSaving ? 0.7 : 1 },
                ]}
                onPress={handleSave}
                disabled={!isValid || isSaving}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.saveBtnText,
                    { color: isValid ? colors.bg : colors.textTertiary },
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
    container: {
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
      gap: 10,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingHorizontal: 20,
      minHeight: 56,
    },
    input: {
      flex: 1,
      fontSize: 28,
      fontWeight: '700',
      paddingVertical: 14,
      letterSpacing: -0.6,
      borderWidth: 0,
    },
    unit: {
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.3,
      marginLeft: 4,
    },
    error: {
      fontSize: 13,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    saveBtn: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
    },
    saveBtnText: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
  })
