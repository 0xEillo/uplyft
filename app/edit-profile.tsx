import { COMMITMENTS, GENDERS, GOALS } from '@/constants/options'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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

  const [editedGender, setEditedGender] = useState<Gender | null>(null)
  const [editedHeight, setEditedHeight] = useState('')
  const [editedWeight, setEditedWeight] = useState('')
  const [editedAge, setEditedAge] = useState('')
  const [editedGoal, setEditedGoal] = useState<Goal | null>(null)
  const [editedCommitment, setEditedCommitment] = useState<string | null>(null)
  const [editedBio, setEditedBio] = useState('')

  const loadProfile = useCallback(async () => {
    if (!user?.email) return

    try {
      setIsLoading(true)
      const profile = await database.profiles.getOrCreate(user.id, user.email)
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
      setEditedGoal(profile?.goal || null)
      setEditedCommitment(profile?.commitment || null)
      setEditedBio(profile?.bio || '')
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

  const handleSave = async () => {
    if (!user) return

    try {
      setIsSaving(true)
      await database.profiles.update(user.id, {
        gender: editedGender,
        height_cm: editedHeight ? parseFloat(editedHeight) : null,
        weight_kg: editedWeight
          ? convertInputToKg(parseFloat(editedWeight))
          : null,
        age: editedAge ? parseInt(editedAge) : null,
        goal: editedGoal,
        commitment: editedCommitment,
        bio: editedBio.trim() || null,
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Gender Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderOptions}>
            {GENDERS.map((gender) => (
              <TouchableOpacity
                key={gender.value}
                style={[
                  styles.genderOption,
                  editedGender === gender.value && styles.genderOptionSelected,
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
          <Text style={styles.label}>Goal</Text>
          <View style={styles.goalOptions}>
            {GOALS.map((goal) => (
              <TouchableOpacity
                key={goal.value}
                style={[
                  styles.goalOption,
                  editedGoal === goal.value && styles.goalOptionSelected,
                ]}
                onPress={() => setEditedGoal(goal.value)}
              >
                <Text
                  style={[
                    styles.goalOptionText,
                    editedGoal === goal.value && styles.goalOptionTextSelected,
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
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
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
      borderRadius: 12,
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
      borderRadius: 12,
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
    characterCount: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'right',
      marginTop: 8,
    },
  })
