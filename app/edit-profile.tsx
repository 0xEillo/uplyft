import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import {
    COMMITMENT_DAYS,
    COMMITMENT_FREQUENCIES,
    EXPERIENCE_LEVELS,
    GENDERS,
    GOALS,
} from '@/constants/options'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { getCommitmentMode } from '@/lib/commitment'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import {
  CommitmentDay,
  CommitmentFrequency,
  CommitmentMode,
  ExperienceLevel,
  Gender,
  Goal,
} from '@/types/database.types'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function EditProfileScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const { trackEvent } = useAnalytics()
  const colors = useThemedColors()
  const { weightUnit, convertToPreferred, convertInputToKg } = useWeightUnits()
  const insets = useSafeAreaInsets()
  const NAVBAR_HEIGHT = 76
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
  const [editedCommitment, setEditedCommitment] = useState<CommitmentDay[]>([])
  const [editedCommitmentFrequency, setEditedCommitmentFrequency] =
    useState<CommitmentFrequency | null>(null)
  const [editedCommitmentMode, setEditedCommitmentMode] =
    useState<CommitmentMode>('frequency')
  const [
    editedExperienceLevel,
    setEditedExperienceLevel,
  ] = useState<ExperienceLevel | null>(null)
  const [editedBio, setEditedBio] = useState('')
  const [editedProfileDescription, setEditedProfileDescription] = useState('')
  const [editedUserTag, setEditedUserTag] = useState('')
  const [originalUserTag, setOriginalUserTag] = useState('')
  const [userTagError, setUserTagError] = useState<string | null>(null)
  const [isCheckingTag, setIsCheckingTag] = useState(false)

  const loadProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      // Use getByIdOrNull for anonymous users (no email), getOrCreate for regular users
      const profile = user.email
        ? await database.profiles.getOrCreate(user.id, user.email)
        : await database.profiles.getByIdOrNull(user.id)
      const resolvedWeightKg = profile?.weight_kg ?? null
      setEditedDisplayName(profile?.display_name || '')
      setEditedAvatarUrl(profile?.avatar_url || null)
      setEditedGender(profile?.gender || null)
      setEditedHeight(profile?.height_cm?.toString() || '')
      setEditedWeight(
        resolvedWeightKg !== null && resolvedWeightKg !== undefined
          ? convertToPreferred(resolvedWeightKg)?.toFixed(
              weightUnit === 'kg' ? 1 : 0,
            ) || ''
          : '',
      )
      setEditedAge(profile?.age?.toString() || '')
      setEditedGoals(profile?.goals || [])
      setEditedCommitment(profile?.commitment || [])
      setEditedCommitmentFrequency(profile?.commitment_frequency || null)
      setEditedCommitmentMode(
        getCommitmentMode({
          commitment: profile?.commitment,
          commitment_frequency: profile?.commitment_frequency,
        }),
      )
      setEditedExperienceLevel(profile?.experience_level || null)
      setEditedBio(profile?.bio || '')
      setEditedProfileDescription(profile?.profile_description || '')
      setEditedUserTag(profile?.user_tag || '')
      setOriginalUserTag(profile?.user_tag || '')
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoading(false)
    }
  }, [convertToPreferred, user?.email, user?.id, weightUnit])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    trackEvent(AnalyticsEvents.EDIT_PROFILE_VIEWED)
  }, [trackEvent])

  useEffect(() => {
    const checkTag = async () => {
      const tag = editedUserTag.trim().toLowerCase()
      
      if (!tag) {
        setUserTagError('Usertag cannot be empty')
        return
      }

      if (tag.length < 3) {
        setUserTagError('Usertag must be at least 3 characters')
        return
      }

      const tagRegex = /^[a-z0-9._]+$/
      if (!tagRegex.test(tag)) {
        setUserTagError('Only lowercase letters, numbers, dots, and underscores allowed')
        return
      }

      if (tag === originalUserTag) {
        setUserTagError(null)
        return
      }

      setIsCheckingTag(true)
      try {
        const existing = await database.profiles.getByUserTag(tag)
        if (existing) {
          setUserTagError('This usertag is already taken')
        } else {
          setUserTagError(null)
        }
      } catch (error) {
        console.error('Error checking user tag:', error)
      } finally {
        setIsCheckingTag(false)
      }
    }

    const timer = setTimeout(checkTag, 500)
    return () => clearTimeout(timer)
  }, [editedUserTag, originalUserTag])

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

      // Final check for usertag to be sure
      if (userTagError) {
        Alert.alert('Error', userTagError)
        return
      }

      await database.profiles.update(user.id, {
        display_name: editedDisplayName.trim() || undefined,
        user_tag: editedUserTag.trim().toLowerCase() || undefined,
        gender: editedGender,
        height_cm: editedHeight ? parseFloat(editedHeight) : null,
        age: editedAge ? parseInt(editedAge) : null,
        goals: editedGoals.length > 0 ? editedGoals : null,
        commitment:
          editedCommitmentMode === 'specific_days' && editedCommitment.length > 0
            ? editedCommitment
            : null,
        commitment_frequency:
          editedCommitmentMode === 'frequency'
            ? editedCommitmentFrequency
            : null,
        experience_level: editedExperienceLevel,
        bio: editedBio.trim() || null,
        profile_description: editedProfileDescription.trim() || null,
      })
      await database.dailyLog.updateDay(user.id, {
        weightKg: editedWeight
          ? convertInputToKg(parseFloat(editedWeight))
          : null,
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
      <View style={styles.container}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerContent={<Text style={styles.headerTitle}>Edit Profile</Text>}
          />
        </BlurredHeader>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BlurredHeader>
        <BaseNavbar
          leftContent={
            <NavbarIsland>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={<Text style={styles.headerTitle}>Edit Profile</Text>}
          rightContent={
            <TouchableOpacity onPress={handleSave} disabled={isSaving} style={styles.saveButtonWrap}>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              ) : (
                <Text style={styles.saveButton}>Save</Text>
              )}
            </TouchableOpacity>
          }
        />
      </BlurredHeader>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + NAVBAR_HEIGHT },
          ]}
          scrollIndicatorInsets={{ top: insets.top + NAVBAR_HEIGHT }}
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
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Ionicons name="camera" size={20} color={colors.surface} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* User Tag */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.label}>Usertag (@handle)</Text>
              {isCheckingTag && <ActivityIndicator size="small" color={colors.brandPrimary} />}
            </View>
            <TextInput
              style={[
                styles.input,
                userTagError && editedUserTag !== originalUserTag && { borderColor: '#ff4444' }
              ]}
              value={editedUserTag}
              onChangeText={(text) => setEditedUserTag(text.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
              placeholder="e.g., fitness_pro"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
            {userTagError && editedUserTag !== originalUserTag && (
              <Text style={{ color: '#ff4444', fontSize: 12, marginTop: 4 }}>{userTagError}</Text>
            )}
          </View>

          {/* Display Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={editedDisplayName}
              onChangeText={setEditedDisplayName}
              placeholder="Enter your display name"
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
            <Text style={styles.label}>Workout commitment</Text>
            <View style={styles.commitmentModeToggle}>
              {[
                {
                  value: 'frequency' as CommitmentMode,
                  label: 'Frequency',
                },
                {
                  value: 'specific_days' as CommitmentMode,
                  label: 'Days',
                },
              ].map((mode) => (
                <TouchableOpacity
                  key={mode.value}
                  style={[
                    styles.commitmentModeOption,
                    editedCommitmentMode === mode.value &&
                      styles.commitmentModeOptionActive,
                  ]}
                  onPress={() => setEditedCommitmentMode(mode.value)}
                >
                  <Text
                    style={[
                      styles.commitmentModeOptionText,
                      editedCommitmentMode === mode.value &&
                        styles.commitmentModeOptionTextActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.commitmentHelperText}>
              {editedCommitmentMode === 'specific_days'
                ? 'Choose the exact days you usually want to train.'
                : 'Pick how many times per week you want to train without choosing days.'}
            </Text>
            <View style={styles.goalOptions}>
              {editedCommitmentMode === 'specific_days'
                ? COMMITMENT_DAYS.map((commitment) => (
                    <TouchableOpacity
                      key={commitment.value}
                      style={[
                        styles.goalOption,
                        editedCommitment.includes(commitment.value) &&
                          styles.goalOptionSelected,
                      ]}
                      onPress={() => {
                        let newCommitment: CommitmentDay[]
                        if (commitment.value === 'not_sure') {
                          newCommitment = ['not_sure']
                        } else {
                          const withoutNotSure = editedCommitment.filter(
                            (value) => value !== 'not_sure',
                          )
                          if (withoutNotSure.includes(commitment.value)) {
                            newCommitment = withoutNotSure.filter(
                              (value) => value !== commitment.value,
                            )
                          } else {
                            newCommitment = [...withoutNotSure, commitment.value]
                          }
                        }
                        setEditedCommitment(newCommitment)
                      }}
                    >
                      <Text
                        style={[
                          styles.goalOptionText,
                          editedCommitment.includes(commitment.value) &&
                            styles.goalOptionTextSelected,
                        ]}
                      >
                        {commitment.label}
                      </Text>
                    </TouchableOpacity>
                  ))
                : COMMITMENT_FREQUENCIES.map((frequency) => (
                    <TouchableOpacity
                      key={frequency.value}
                      style={[
                        styles.goalOption,
                        editedCommitmentFrequency === frequency.value &&
                          styles.goalOptionSelected,
                      ]}
                      onPress={() => setEditedCommitmentFrequency(frequency.value)}
                    >
                      <Text
                        style={[
                          styles.goalOptionText,
                          editedCommitmentFrequency === frequency.value &&
                            styles.goalOptionTextSelected,
                        ]}
                      >
                        {frequency.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
            </View>
          </View>

          {/* Experience Level Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Experience Level</Text>
            <View style={styles.goalOptions}>
              {EXPERIENCE_LEVELS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.goalOption,
                    editedExperienceLevel === item.value &&
                      styles.goalOptionSelected,
                  ]}
                  onPress={() => setEditedExperienceLevel(item.value)}
                >
                  <Text
                    style={[
                      styles.goalOptionText,
                      editedExperienceLevel === item.value &&
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
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  weightUnit: 'kg' | 'lb',
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    saveButtonWrap: {
      paddingHorizontal: 4,
      height: 44,
      justifyContent: 'center',
    },
    saveButton: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.brandPrimary,
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
      backgroundColor: colors.brandPrimary,
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
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.bg,
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      fontSize: 16,
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
    },
    genderOptionSelected: {
      borderColor: colors.brandPrimary,
      backgroundColor: colors.brandPrimary,
    },
    genderOptionText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    genderOptionTextSelected: {
      color: colors.surface,
    },
    goalOptions: {
      gap: 8,
    },
    commitmentModeToggle: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 12,
      backgroundColor: colors.border + '40',
      marginBottom: 10,
      alignSelf: 'stretch',
    },
    commitmentModeOption: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
    },
    commitmentModeOptionActive: {
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    commitmentModeOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    commitmentModeOptionTextActive: {
      color: colors.textPrimary,
      fontWeight: '700',
      textAlign: 'center',
    },
    commitmentHelperText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    goalOption: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    goalOptionSelected: {
      borderColor: colors.brandPrimary,
      backgroundColor: colors.brandPrimary,
    },
    goalOptionText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    goalOptionTextSelected: {
      color: colors.surface,
    },
    bioInput: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      fontSize: 15,
      color: colors.textPrimary,
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
