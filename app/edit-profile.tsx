import {
  COMMITMENTS,
  GENDERS,
  GOALS,
  TRAINING_YEARS,
} from '@/constants/options'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Gender, Goal, TrainingYears } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function EditProfileScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const { weightUnit, convertToPreferred, convertInputToKg } = useWeightUnits()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const [editedDisplayName, setEditedDisplayName] = useState('')
  const [editedAvatarUrl, setEditedAvatarUrl] = useState<string | null>(null)
  const [editedGender, setEditedGender] = useState<Gender | null>(null)
  const [editedHeight, setEditedHeight] = useState('')
  const [editedWeight, setEditedWeight] = useState('')
  const [editedAge, setEditedAge] = useState('')
  const [editedGoals, setEditedGoals] = useState<Goal[]>([])
  const [editedCommitment, setEditedCommitment] = useState<string | null>(null)
  const [
    editedTrainingYears,
    setEditedTrainingYears,
  ] = useState<TrainingYears | null>(null)
  const [editedBio, setEditedBio] = useState('')
  const [editedProfileDescription, setEditedProfileDescription] = useState('')

  const loadProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      // Use getByIdOrNull for anonymous users (no email), getOrCreate for regular users
      const profile = user.email
        ? await database.profiles.getOrCreate(user.id, user.email)
        : await database.profiles.getByIdOrNull(user.id)
      setEditedDisplayName(profile?.display_name || '')
      setEditedAvatarUrl(profile?.avatar_url || null)
      setEditedGender(profile?.gender || null)
      setEditedHeight(profile?.height_cm?.toString() || '')
      setEditedWeight(
        profile?.weight_kg !== null && profile?.weight_kg !== undefined
          ? convertToPreferred(profile.weight_kg)?.toFixed(
              weightUnit === 'kg' ? 1 : 0,
            ) || ''
          : '',
      )
      setEditedAge(profile?.age?.toString() || '')
      setEditedGoals(profile?.goals || [])
      setEditedCommitment(profile?.commitment || null)
      setEditedTrainingYears(profile?.training_years || null)
      setEditedBio(profile?.bio || '')
      setEditedProfileDescription(profile?.profile_description || '')
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoading(false)
    }
  }, [convertToPreferred, user?.email, user?.id, weightUnit])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const styles = createStyles(colors, weightUnit)

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera roll permissions to upload a profile picture.',
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert('Error', 'Failed to pick image. Please try again.')
    }
  }

  const uploadImage = async (uri: string) => {
    if (!user) return

    try {
      setIsUploadingImage(true)

      const response = await fetch(uri)
      const arrayBuffer = await response.arrayBuffer()
      const fileData = new Uint8Array(arrayBuffer)

      const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg'
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileData, {
          contentType: `image/${fileExt}`,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setEditedAvatarUrl(urlData.publicUrl)

      // Also update the profile immediately so the avatar persists
      await database.profiles.update(user.id, {
        avatar_url: urlData.publicUrl,
      })
    } catch (error) {
      console.error('Error uploading image:', error)
      Alert.alert('Error', 'Failed to upload image. Please try again.')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    try {
      setIsSaving(true)
      await database.profiles.update(user.id, {
        display_name: editedDisplayName.trim() || undefined,
        gender: editedGender,
        height_cm: editedHeight ? parseFloat(editedHeight) : null,
        weight_kg: editedWeight
          ? convertInputToKg(parseFloat(editedWeight))
          : null,
        age: editedAge ? parseInt(editedAge) : null,
        goals: editedGoals.length > 0 ? editedGoals : null,
        commitment: editedCommitment,
        training_years: editedTrainingYears,
        bio: editedBio.trim() || null,
        profile_description: editedProfileDescription.trim() || null,
      })
      router.back()
    } catch (error) {
      console.error('Error updating profile:', error)
      Alert.alert('Error', 'Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {editedAvatarUrl ? (
                <Image
                  source={{ uri: editedAvatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={48} color="#fff" />
                </View>
              )}
              <TouchableOpacity
                style={styles.avatarEditButton}
                onPress={handlePickImage}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Display Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={editedDisplayName}
              onChangeText={setEditedDisplayName}
              placeholder="Enter your username"
              placeholderTextColor={colors.textPlaceholder}
              maxLength={50}
            />
          </View>

          {/* Profile Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Profile Description</Text>
            <Text style={styles.description}>
              This shows under your name on your public profile.
            </Text>
            <TextInput
              style={[styles.bioInput, styles.profileDescriptionInput]}
              value={editedProfileDescription}
              onChangeText={setEditedProfileDescription}
              placeholder="E.g., Hybrid athlete. Coffee & deadlifts."
              placeholderTextColor={colors.textPlaceholder}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={160}
            />
            <Text style={styles.characterCount}>
              {editedProfileDescription.length}/160
            </Text>
          </View>

          {/* Gender Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderOptions}>
              {GENDERS.map((gender) => (
                <TouchableOpacity
                  key={gender.value}
                  style={[
                    styles.genderOption,
                    editedGender === gender.value &&
                      styles.genderOptionSelected,
                  ]}
                  onPress={() => setEditedGender(gender.value)}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      editedGender === gender.value &&
                        styles.genderOptionTextSelected,
                    ]}
                  >
                    {gender.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Height Input */}
          <View style={styles.section}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={editedHeight}
              onChangeText={setEditedHeight}
              placeholder="e.g., 175"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Weight Input */}
          <View style={styles.section}>
            <Text style={styles.label}>{`Weight (${weightUnit})`}</Text>
            <TextInput
              style={styles.input}
              value={editedWeight}
              onChangeText={setEditedWeight}
              placeholder="e.g., 70"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Age Input */}
          <View style={styles.section}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              value={editedAge}
              onChangeText={setEditedAge}
              placeholder="e.g., 25"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="number-pad"
            />
          </View>

          {/* Goal Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Goals (select all that apply)</Text>
            <View style={styles.goalOptions}>
              {GOALS.map((goal) => (
                <TouchableOpacity
                  key={goal.value}
                  style={[
                    styles.goalOption,
                    editedGoals.includes(goal.value) &&
                      styles.goalOptionSelected,
                  ]}
                  onPress={() => {
                    const newGoals = editedGoals.includes(goal.value)
                      ? editedGoals.filter((g) => g !== goal.value)
                      : [...editedGoals, goal.value]
                    setEditedGoals(newGoals)
                  }}
                >
                  <Text
                    style={[
                      styles.goalOptionText,
                      editedGoals.includes(goal.value) &&
                        styles.goalOptionTextSelected,
                    ]}
                  >
                    {goal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Commitment Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Commitment</Text>
            <View style={styles.goalOptions}>
              {COMMITMENTS.map((commitment) => (
                <TouchableOpacity
                  key={commitment.value}
                  style={[
                    styles.goalOption,
                    editedCommitment === commitment.value &&
                      styles.goalOptionSelected,
                  ]}
                  onPress={() => setEditedCommitment(commitment.value)}
                >
                  <Text
                    style={[
                      styles.goalOptionText,
                      editedCommitment === commitment.value &&
                        styles.goalOptionTextSelected,
                    ]}
                  >
                    {commitment.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Training Years Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Years of Training</Text>
            <View style={styles.goalOptions}>
              {TRAINING_YEARS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.goalOption,
                    editedTrainingYears === item.value &&
                      styles.goalOptionSelected,
                  ]}
                  onPress={() => setEditedTrainingYears(item.value)}
                >
                  <Text
                    style={[
                      styles.goalOptionText,
                      editedTrainingYears === item.value &&
                        styles.goalOptionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Bio Input */}
          <View style={styles.section}>
            <Text style={styles.label}>AI Context (Optional)</Text>
            <Text style={styles.description}>
              This information helps our AI provide personalized workout
              recommendations
            </Text>
            <TextInput
              style={styles.bioInput}
              value={editedBio}
              onChangeText={setEditedBio}
              placeholder="E.g., I have a knee injury, I do powerlifting, I'm a beginner..."
              placeholderTextColor={colors.textPlaceholder}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.characterCount}>{editedBio.length}/500</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  weightUnit: 'kg' | 'lb',
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    placeholder: {
      width: 60,
    },
    saveButton: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    keyboardAvoid: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    avatarSection: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    avatarWrapper: {
      position: 'relative',
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarEditButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.background,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 20,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 20,
    },
    input: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    genderOptions: {
      gap: 8,
    },
    genderOption: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.white,
    },
    genderOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    genderOptionText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    genderOptionTextSelected: {
      color: colors.white,
    },
    goalOptions: {
      gap: 8,
    },
    goalOption: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.white,
    },
    goalOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    goalOptionText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    goalOptionTextSelected: {
      color: colors.white,
    },
    bioInput: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    profileDescriptionInput: {
      minHeight: 80,
    },
    characterCount: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'right',
      marginTop: 8,
    },
  })
