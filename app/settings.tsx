import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const { isDark, toggleTheme } = useTheme()
  const colors = useThemedColors()
  const { weightUnit, setWeightUnit } = useWeightUnits()
  const { isProMember, customerInfo, restorePurchases } = useSubscription()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  // Preferences
  const [showExamples, setShowExamples] = useState(true)

  const loadProfile = useCallback(async () => {
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
  }, [user?.email, user?.id])

  const loadPreferences = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem('@show_workout_examples')
      if (value !== null) {
        setShowExamples(value === 'true')
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    }
  }, [])

  useEffect(() => {
    loadProfile()
    loadPreferences()
  }, [loadPreferences, loadProfile])

  const styles = createStyles(colors)

  const handleToggleExamples = async (value: boolean) => {
    try {
      setShowExamples(value)
      await AsyncStorage.setItem('@show_workout_examples', value.toString())
    } catch (error) {
      console.error('Error saving preference:', error)
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
            router.replace('/(auth)/welcome')
          } catch (error) {
            Alert.alert(
              'Error',
              error instanceof Error ? error.message : 'Failed to sign out',
            )
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
              router.replace('/(auth)/welcome')
              Alert.alert(
                'Account Deleted',
                'Your account has been permanently deleted.',
              )
            } catch (error) {
              console.error('Error deleting account:', error)
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Failed to delete account. Please try again.',
              )
            }
          },
        },
      ],
    )
  }

  const handleContactSupport = async () => {
    const supportEmail = 'support@repaifit.app'
    const subject = 'Support Request'
    const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(
      subject,
    )}`

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl)
      if (canOpen) {
        await Linking.openURL(mailtoUrl)
      } else {
        Alert.alert(
          'Email Not Available',
          `Please send an email to ${supportEmail}`,
          [{ text: 'OK' }],
        )
      }
    } catch (error) {
      console.error('Error opening email:', error)
      Alert.alert(
        'Email Not Available',
        `Please send an email to ${supportEmail}`,
        [{ text: 'OK' }],
      )
    }
  }

  const handleRestorePurchases = async () => {
    try {
      setIsRestoring(true)
      await restorePurchases()
      Alert.alert('Success', 'Your purchases have been restored.', [
        { text: 'OK' },
      ])
    } catch (error) {
      Alert.alert(
        'Restore Failed',
        'No previous purchases found or restore failed. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setIsRestoring(false)
    }
  }

  const handleManageSubscription = async () => {
    // Open App Store subscription management
    const subscriptionUrl = 'https://apps.apple.com/account/subscriptions'
    try {
      const canOpen = await Linking.canOpenURL(subscriptionUrl)
      if (canOpen) {
        await Linking.openURL(subscriptionUrl)
      } else {
        Alert.alert(
          'Unable to Open',
          'Please open Settings > [Your Name] > Subscriptions to manage your subscription.',
          [{ text: 'OK' }]
        )
      }
    } catch (error) {
      console.error('Error opening subscription management:', error)
      Alert.alert(
        'Unable to Open',
        'Please open Settings > [Your Name] > Subscriptions to manage your subscription.',
        [{ text: 'OK' }]
      )
    }
  }

  // Get subscription status display
  const getSubscriptionStatus = () => {
    if (!customerInfo) return 'Loading...'

    const activeEntitlements = customerInfo.entitlements.active
    if (Object.keys(activeEntitlements).length === 0) {
      return 'Free'
    }

    const proEntitlement = activeEntitlements['Pro']
    if (proEntitlement) {
      const expirationDate = proEntitlement.expirationDate
      if (expirationDate) {
        const date = new Date(expirationDate)
        const now = new Date()
        const isTrialing = proEntitlement.periodType === 'trial'

        if (date > now) {
          if (isTrialing) {
            const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            return `Trial (${daysLeft} days left)`
          } else {
            return 'Active'
          }
        }
      }
    }

    return 'Free'
  }

  const getNextBillingDate = () => {
    if (!customerInfo) return null

    const proEntitlement = customerInfo.entitlements.active['Pro']
    if (proEntitlement && proEntitlement.expirationDate) {
      const date = new Date(proEntitlement.expirationDate)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }

    return null
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
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
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons name="camera" size={20} color={colors.white} />
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
                    color={colors.textSecondary}
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
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailLabelContainer}>
                  <Ionicons name="at" size={20} color={colors.textSecondary} />
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
                    color={colors.textSecondary}
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

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>

          <View style={styles.subscriptionCard}>
            {/* Status */}
            <View style={styles.subscriptionRow}>
              <View style={styles.subscriptionLeft}>
                <Text style={styles.subscriptionLabel}>Status</Text>
              </View>
              <View style={styles.subscriptionStatusBadge}>
                <Text
                  style={[
                    styles.subscriptionStatusText,
                    isProMember && styles.subscriptionStatusTextActive,
                  ]}
                >
                  {getSubscriptionStatus()}
                </Text>
              </View>
            </View>

            {/* Next Billing Date (if subscribed) */}
            {isProMember && getNextBillingDate() && (
              <>
                <View style={styles.subscriptionDivider} />
                <View style={styles.subscriptionRow}>
                  <View style={styles.subscriptionLeft}>
                    <Text style={styles.subscriptionLabel}>
                      {getSubscriptionStatus().startsWith('Trial') ? 'Trial Ends' : 'Renews'}
                    </Text>
                  </View>
                  <Text style={styles.subscriptionValue}>
                    {getNextBillingDate()}
                  </Text>
                </View>
              </>
            )}

            {/* Divider */}
            <View style={styles.subscriptionDivider} />

            {/* Restore Purchases */}
            <TouchableOpacity
              style={styles.subscriptionButton}
              onPress={handleRestorePurchases}
              disabled={isRestoring}
            >
              <Ionicons
                name="refresh-outline"
                size={20}
                color={colors.primary}
              />
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.subscriptionButtonText}>
                  Restore Purchases
                </Text>
              )}
            </TouchableOpacity>

            {/* Manage Subscription (if subscribed) */}
            {isProMember && (
              <>
                <View style={styles.subscriptionDivider} />
                <TouchableOpacity
                  style={styles.subscriptionButton}
                  onPress={handleManageSubscription}
                >
                  <Ionicons
                    name="settings-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.subscriptionButtonText}>
                    Manage Subscription
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/edit-profile')}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="person-outline"
                size={22}
                color={colors.textSecondary}
              />
              <View>
                <Text style={styles.actionButtonTextNeutral}>
                  Personal Details
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textLight}
            />
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.preferenceCard}>
            {/* Unit Toggle */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View>
                  <Text style={styles.preferenceTitle}>Weight Units</Text>
                </View>
              </View>
              <View style={styles.unitToggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    weightUnit === 'kg' && styles.unitButtonActive,
                  ]}
                  onPress={() => setWeightUnit('kg')}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      weightUnit === 'kg' && styles.unitButtonTextActive,
                    ]}
                  >
                    kg
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    weightUnit === 'lb' && styles.unitButtonActive,
                  ]}
                  onPress={() => setWeightUnit('lb')}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      weightUnit === 'lb' && styles.unitButtonTextActive,
                    ]}
                  >
                    lbs
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.preferenceDivider} />

            {/* Dark Mode Toggle */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View>
                  <Text style={styles.preferenceTitle}>Dark Mode</Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
                thumbColor={isDark ? colors.primary : '#F3F4F6'}
              />
            </View>

            {/* Divider */}
            <View style={styles.preferenceDivider} />

            {/* Show Examples Toggle */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View>
                  <Text style={styles.preferenceTitle}>
                    Show Workout Examples
                  </Text>
                </View>
              </View>
              <Switch
                value={showExamples}
                onValueChange={handleToggleExamples}
                trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
                thumbColor={showExamples ? colors.primary : '#F3F4F6'}
              />
            </View>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleContactSupport}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="mail-outline"
                size={22}
                color={colors.textSecondary}
              />
              <View>
                <Text style={styles.actionButtonTextNeutral}>
                  Contact Support
                </Text>
                <Text style={styles.supportEmail}>support@repaifit.app</Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textLight}
            />
          </TouchableOpacity>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="log-out-outline"
                size={22}
                color={colors.textSecondary}
              />
              <Text style={styles.actionButtonTextNeutral}>Sign Out</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textLight}
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
              <Ionicons name="trash-outline" size={22} color={colors.error} />
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
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Enter username"
              placeholderTextColor={colors.textPlaceholder}
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
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
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
    scrollContent: {
      paddingBottom: 40,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    profileCard: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 20,
      shadowColor: colors.shadow,
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
      backgroundColor: colors.backgroundLight,
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
      borderColor: colors.white,
      shadowColor: colors.shadow,
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
      color: colors.textSecondary,
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
      color: colors.text,
      textAlign: 'right',
    },
    editButton: {
      padding: 4,
    },
    actionButton: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 18,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: colors.shadow,
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
      color: colors.text,
    },
    supportEmail: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    dangerButton: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 18,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    dangerButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.error,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: colors.shadow,
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
      color: colors.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalInput: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalCancelButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
    },
    modalCancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    modalSaveButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    modalSaveButtonDisabled: {
      opacity: 0.5,
    },
    modalSaveText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.white,
    },
    preferenceCard: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    preferenceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    unitToggleContainer: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundLight,
      borderRadius: 20,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    unitButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
    },
    unitButtonActive: {
      backgroundColor: colors.primary,
    },
    unitButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    unitButtonTextActive: {
      color: colors.white,
    },
    preferenceLeft: {
      flex: 1,
    },
    preferenceTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    preferenceDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    preferenceDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    subscriptionCard: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    subscriptionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    subscriptionLeft: {
      flex: 1,
    },
    subscriptionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    subscriptionValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    subscriptionStatusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.backgroundLight,
    },
    subscriptionStatusText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    subscriptionStatusTextActive: {
      color: colors.primary,
    },
    subscriptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    subscriptionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    subscriptionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
  })
