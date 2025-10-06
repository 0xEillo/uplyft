import { AppColors } from '@/constants/colors'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Gender, Goal, Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const GOALS: { value: Goal; label: string }[] = [
  { value: 'build_muscle', label: 'Build Muscle' },
  { value: 'gain_strength', label: 'Gain Strength' },
  { value: 'lose_fat', label: 'Lose Fat' },
  { value: 'general_fitness', label: 'General Fitness' },
]

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Context editing states
  const [isEditContextModalVisible, setIsEditContextModalVisible] = useState(
    false,
  )
  const [editedGender, setEditedGender] = useState<Gender | null>(null)
  const [editedHeight, setEditedHeight] = useState('')
  const [editedWeight, setEditedWeight] = useState('')
  const [editedGoal, setEditedGoal] = useState<Goal | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    if (!user?.email) return

    try {
      setIsLoading(true)
      const data = await database.profiles.getOrCreate(user.id, user.email)
      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut()
            router.replace('/(auth)/login')
          } catch (error) {
            Alert.alert('Error', error.message || 'Failed to sign out')
          }
        },
      },
    ])
  }

  const handleEditName = () => {
    setEditedName(profile?.display_name || '')
    setIsEditModalVisible(true)
  }

  const handleSaveName = async () => {
    if (!user || !editedName.trim()) return

    try {
      setIsSaving(true)
      const updated = await database.profiles.update(user.id, {
        display_name: editedName.trim(),
      })
      setProfile(updated)
      setIsEditModalVisible(false)
    } catch (error) {
      console.error('Error updating name:', error)
      Alert.alert('Error', 'Failed to update username. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera roll permissions to upload a profile picture.',
        )
        return
      }

      // Launch image picker
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

      // Fetch the image as array buffer
      const response = await fetch(uri)
      const arrayBuffer = await response.arrayBuffer()
      const fileData = new Uint8Array(arrayBuffer)

      // Create file name
      const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg'
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileData, {
          contentType: `image/${fileExt}`,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile with new avatar URL
      const updated = await database.profiles.update(user.id, {
        avatar_url: urlData.publicUrl,
      })

      setProfile(updated)
    } catch (error) {
      console.error('Error uploading image:', error)
      Alert.alert('Error', 'Failed to upload image. Please try again.')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleEditContext = () => {
    setEditedGender(profile?.gender || null)
    setEditedHeight(profile?.height_cm?.toString() || '')
    setEditedWeight(profile?.weight_kg?.toString() || '')
    setEditedGoal(profile?.goal || null)
    setIsEditContextModalVisible(true)
  }

  const handleSaveContext = async () => {
    if (!user) return

    try {
      setIsSaving(true)
      const updated = await database.profiles.update(user.id, {
        gender: editedGender,
        height_cm: editedHeight ? parseFloat(editedHeight) : null,
        weight_kg: editedWeight ? parseFloat(editedWeight) : null,
        goal: editedGoal,
      })
      setProfile(updated)
      setIsEditContextModalVisible(false)
    } catch (error) {
      console.error('Error updating profile context:', error)
      Alert.alert('Error', 'Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data, workouts, and progress will be permanently deleted. Are you absolutely sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete user account via Supabase admin API
              const { error } = await supabase.rpc('delete_user')

              if (error) throw error

              await signOut()
              router.replace('/(auth)/login')
              Alert.alert(
                'Account Deleted',
                'Your account has been permanently deleted.',
              )
            } catch (error) {
              console.error('Error deleting account:', error)
              Alert.alert(
                'Error',
                error?.message || 'Failed to delete account. Please try again.',
              )
            }
          },
        },
      ],
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>

          {/* Avatar */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarWrapper}>
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
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
                    <ActivityIndicator size="small" color={AppColors.white} />
                  ) : (
                    <Ionicons name="camera" size={20} color={AppColors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Profile Details */}
            <View style={styles.profileDetails}>
              <View style={styles.detailRow}>
                <View style={styles.detailLabelContainer}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={AppColors.textSecondary}
                  />
                  <Text style={styles.detailLabel}>Username</Text>
                </View>
                <View style={styles.detailValueContainer}>
                  <Text style={styles.detailValue}>
                    {profile?.display_name || 'Not set'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleEditName}
                    style={styles.editButton}
                  >
                    <Ionicons
                      name="create-outline"
                      size={20}
                      color={AppColors.primary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailLabelContainer}>
                  <Ionicons
                    name="at"
                    size={20}
                    color={AppColors.textSecondary}
                  />
                  <Text style={styles.detailLabel}>User Tag</Text>
                </View>
                <Text style={styles.detailValue}>
                  @{profile?.user_tag || 'Not set'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailLabelContainer}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={AppColors.textSecondary}
                  />
                  <Text style={styles.detailLabel}>Email</Text>
                </View>
                <Text style={styles.detailValue}>
                  {user?.email || 'Not set'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* User Context Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.profileCard}>
            <View style={styles.contextRow}>
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>Gender</Text>
                <Text style={styles.contextValue}>
                  {profile?.gender
                    ? GENDERS.find((g) => g.value === profile.gender)?.label
                    : 'Not set'}
                </Text>
              </View>
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>Goal</Text>
                <Text style={styles.contextValue}>
                  {profile?.goal
                    ? GOALS.find((g) => g.value === profile.goal)?.label
                    : 'Not set'}
                </Text>
              </View>
            </View>

            <View style={styles.contextRow}>
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>Height</Text>
                <Text style={styles.contextValue}>
                  {profile?.height_cm ? `${profile.height_cm} cm` : 'Not set'}
                </Text>
              </View>
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>Weight</Text>
                <Text style={styles.contextValue}>
                  {profile?.weight_kg ? `${profile.weight_kg} kg` : 'Not set'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.editContextButton}
              onPress={handleEditContext}
            >
              <Text style={styles.editContextButtonText}>Edit Context</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="log-out-outline"
                size={22}
                color={AppColors.textSecondary}
              />
              <Text style={styles.actionButtonTextNeutral}>Sign Out</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={AppColors.textLight}
            />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleDeleteAccount}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="trash-outline"
                size={22}
                color={AppColors.white}
              />
              <Text style={styles.dangerButtonText}>Delete Account</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Username Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Username</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={AppColors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Enter username"
              placeholderTextColor={AppColors.textPlaceholder}
              autoFocus
              maxLength={50}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (!editedName.trim() || isSaving) &&
                    styles.modalSaveButtonDisabled,
                ]}
                onPress={handleSaveName}
                disabled={!editedName.trim() || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={AppColors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Context Modal */}
      <Modal
        visible={isEditContextModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditContextModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Personal Information</Text>
                <TouchableOpacity
                  onPress={() => setIsEditContextModalVisible(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={AppColors.text} />
                </TouchableOpacity>
              </View>

              {/* Gender Selection */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Gender</Text>
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
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editedHeight}
                  onChangeText={setEditedHeight}
                  placeholder="e.g., 175"
                  placeholderTextColor={AppColors.textPlaceholder}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Weight Input */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editedWeight}
                  onChangeText={setEditedWeight}
                  placeholder="e.g., 70"
                  placeholderTextColor={AppColors.textPlaceholder}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Goal Selection */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Goal</Text>
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
                          editedGoal === goal.value &&
                            styles.goalOptionTextSelected,
                        ]}
                      >
                        {goal.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setIsEditContextModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSaveButton,
                    isSaving && styles.modalSaveButtonDisabled,
                  ]}
                  onPress={handleSaveContext}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={AppColors.white} />
                  ) : (
                    <Text style={styles.modalSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: AppColors.text,
  },
  placeholder: {
    width: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: AppColors.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: AppColors.backgroundLight,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: AppColors.primary,
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
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: AppColors.white,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileDetails: {
    gap: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: AppColors.textSecondary,
  },
  detailValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.text,
    textAlign: 'right',
  },
  editButton: {
    padding: 4,
  },
  actionButton: {
    backgroundColor: AppColors.white,
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButtonTextNeutral: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  dangerButton: {
    backgroundColor: AppColors.error,
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: AppColors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalInput: {
    backgroundColor: AppColors.backgroundLight,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: AppColors.backgroundLight,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  modalSaveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.white,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  contextRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  contextItem: {
    flex: 1,
  },
  contextLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: AppColors.textSecondary,
    marginBottom: 4,
  },
  contextValue: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  editContextButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
  },
  editContextButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.white,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 12,
  },
  genderOptions: {
    gap: 8,
  },
  genderOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: AppColors.border,
    backgroundColor: AppColors.white,
  },
  genderOptionSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primary,
  },
  genderOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.text,
    textAlign: 'center',
  },
  genderOptionTextSelected: {
    color: AppColors.white,
  },
  goalOptions: {
    gap: 8,
  },
  goalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: AppColors.border,
    backgroundColor: AppColors.white,
  },
  goalOptionSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primary,
  },
  goalOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.text,
    textAlign: 'center',
  },
  goalOptionTextSelected: {
    color: AppColors.white,
  },
})
