import { useThemedColors } from '@/hooks/useThemedColors'
import { useUnit } from '@/contexts/unit-context'
import { Ionicons } from '@expo/vector-icons'
import React, { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface LogMeasuresModalProps {
  visible: boolean
  onClose: () => void
  onSave: (data: { weightKg?: number; bodyFat?: number; photoUris?: string[] }) => Promise<void>
  onAddPhoto: () => Promise<string[]>
  onScanPress: () => void
}

export function LogMeasuresModal({
  visible,
  onClose,
  onSave,
  onAddPhoto,
  onScanPress,
}: LogMeasuresModalProps) {
  const colors = useThemedColors()
  const { weightUnit } = useUnit()
  const insets = useSafeAreaInsets()

  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [photoUris, setPhotoUris] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setWeight('')
      setBodyFat('')
      setPhotoUris([])
      setIsSaving(false)
    }
  }, [visible])

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const weightNum = weight ? parseFloat(weight) : undefined
      const bfNum = bodyFat ? parseFloat(bodyFat) : undefined
      
      const weightKg = weightNum
        ? weightUnit === 'lbs'
          ? weightNum / 2.20462
          : weightNum
        : undefined

      await onSave({
        weightKg: weightKg && !isNaN(weightKg) ? weightKg : undefined,
        bodyFat: bfNum && !isNaN(bfNum) ? bfNum : undefined,
        photoUris: photoUris.length > 0 ? photoUris : undefined,
      })
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddPicture = async () => {
    const uris = await onAddPhoto()
    if (uris && uris.length > 0) {
      setPhotoUris((prev) => [...prev, ...uris])
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index))
  }

  const hasData = weight.trim() !== '' || bodyFat.trim() !== '' || photoUris.length > 0

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[{ flex: 1, backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: colors.brandPrimary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Log Measurements</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasData || isSaving}
            style={styles.headerButton}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            ) : (
              <Text
                style={[
                  styles.headerButtonText,
                  {
                    color: hasData ? colors.brandPrimary : colors.textTertiary,
                    fontWeight: '700',
                  },
                ]}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.section}>
              <View style={styles.dateRow}>
                <Text style={[styles.dateLabel, { color: colors.textPrimary }]}>Date</Text>
                <Text style={[styles.dateValue, { color: colors.textSecondary }]}>
                  {new Date().toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Progress Picture</Text>
              
              <View style={styles.photosRow}>
                {photoUris.map((uri, i) => (
                  <View key={i} style={styles.photoContainer}>
                    <Image source={{ uri }} style={styles.photo} />
                    <TouchableOpacity
                      style={styles.removePhotoBtn}
                      onPress={() => handleRemovePhoto(i)}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.bg} />
                    </TouchableOpacity>
                  </View>
                ))}
                
                <TouchableOpacity
                  style={[
                    styles.addPictureBtn,
                    photoUris.length > 0 && styles.addPictureBtnSmall,
                    { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + '15' },
                  ]}
                  onPress={handleAddPicture}
                >
                  <Ionicons name="camera-outline" size={24} color={colors.brandPrimary} />
                  {photoUris.length === 0 && (
                    <Text style={[styles.addPictureText, { color: colors.brandPrimary }]}>
                      Add Picture
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Measurements</Text>
              
              <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Body Weight ({weightUnit})</Text>
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary }]}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder={`e.g. 75`}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>

              <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Body Fat (%)</Text>
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary }]}
                  value={bodyFat}
                  onChangeText={setBodyFat}
                  placeholder={`e.g. 15`}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
              
              <TouchableOpacity 
                style={[styles.scanButton, { backgroundColor: colors.brandPrimary + '15' }]}
                onPress={onScanPress}
              >
                <Ionicons name="scan-outline" size={20} color={colors.brandPrimary} />
                <Text style={[styles.scanButtonText, { color: colors.brandPrimary }]}>
                  Run AI Body Scan
                </Text>
              </TouchableOpacity>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    minWidth: 60,
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  dateValue: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  addPictureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
    width: '100%',
    minHeight: 100,
  },
  addPictureBtnSmall: {
    width: 100,
    height: 100,
    minHeight: 100,
  },
  addPictureText: {
    fontSize: 16,
    fontWeight: '500',
  },
  photosRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  photoContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  inputField: {
    fontSize: 16,
    textAlign: 'right',
    minWidth: 100,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
