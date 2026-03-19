import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { COACH_OPTIONS, CoachId } from '@/lib/coaches'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface CoachSelectionSheetProps {
  visible: boolean
  onClose: () => void
}

export function CoachSelectionSheet({
  visible,
  onClose,
}: CoachSelectionSheetProps) {
  const router = useRouter()
  const { profile, updateProfile } = useProfile()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const [isUpdating, setIsUpdating] = useState(false)

  // Check if user has all necessary data
  const hasProfileStats = 
      profile?.weight_kg && 
      profile?.height_cm && 
      profile?.age && 
      profile?.gender



  const handleSelectCoach = async (coachId: CoachId) => {
    haptic('light')
    if (profile?.coach === coachId) {
      return
    }

    try {
      setIsUpdating(true)
      await updateProfile({ coach: coachId })
    } catch (error) {
      console.error('Error updating coach:', error)
      Alert.alert('Error', 'Unable to update coach. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleNavigateToProfile = () => {
      onClose()
      // Small delay to allow modal to close smoothly
      setTimeout(() => {
        router.push('/(tabs)/profile')
      }, 300)
  }



  const styles = createStyles(colors, insets)

  const sheetContent = (
    <View style={styles.sheetContent}>
      <View style={styles.header}>
        <View style={styles.handle} />
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {!hasProfileStats && (
            <View style={styles.section}>
            <Text style={styles.sectionTitle}>Physical Attributes</Text>
              <TouchableOpacity style={styles.missingStatsContainer} onPress={handleNavigateToProfile}>
                  <View style={styles.missingStatsIconContainer}>
                      <Ionicons name="body-outline" size={24} color={colors.brandPrimary} />
                  </View>
                  <View style={styles.missingStatsTextContainer}>
                      <Text style={styles.missingStatsTitle}>Complete Profile</Text>
                      <Text style={styles.missingStatsDescription}>
                          Add weight, height, and age to get personalized calorie goals.
                      </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Coach</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {COACH_OPTIONS.map((coach) => {
              const isSelected = profile?.coach === coach.id
              return (
                <TouchableOpacity
                  key={coach.id}
                  style={[
                    styles.coachCard,
                    isSelected && styles.coachCardSelected,
                  ]}
                  onPress={() => handleSelectCoach(coach.id)}
                  disabled={isUpdating}
                >
                  <View style={styles.avatarContainer}>
                    <Image source={coach.image} style={styles.avatar} />
                    <View style={styles.emojiBadge}>
                      {coach.id === 'kino' && <Text style={styles.emojiText}>👊</Text>}
                      {coach.id === 'maya' && <Text style={styles.emojiText}>👏</Text>}
                      {coach.id === 'ross' && <Text style={styles.emojiText}>📋</Text>}
                    </View>
                  </View>
                  <Text style={styles.coachName}>{coach.name}</Text>
                  <Text style={styles.coachDescription} numberOfLines={3}>
                    {coach.description}
                  </Text>
                  
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark" size={14} color={colors.surface} />
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {isUpdating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      )}
    </View>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.sheetContainer}>
            {sheetContent}
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const createStyles = (colors: any, insets: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      maxHeight: '85%',
      width: '100%',
      paddingBottom: insets.bottom,
    },
    sheetContent: {
      width: '100%',
      height: '100%',
    },
    header: {
      alignItems: 'center',
      paddingTop: 14,
      paddingBottom: 14,
      paddingHorizontal: 20,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginBottom: 14,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 0,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 0,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
      padding: 16,
      borderRadius: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 100,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'right',
      marginRight: 4,
    },
    unitText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    missingStatsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceSubtle,
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    missingStatsIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    missingStatsTextContainer: {
        flex: 1,
    },
    missingStatsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    missingStatsDescription: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    attributesSummary: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceSubtle,
        borderRadius: 16,
        padding: 16,
        justifyContent: 'space-between',
    },
    attributeItem: {
        alignItems: 'center',
        flex: 1,
    },
    attributeValue: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    attributeUnit: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    attributeDivider: {
        width: 1,
        height: '100%',
        backgroundColor: colors.border,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 40,
      gap: 28,
    },
    horizontalScrollContent: {
      paddingHorizontal: 20,
      gap: 12,
    },
    genderContainer: {
        flexDirection: 'row',
        marginTop: 16,
        backgroundColor: colors.surfaceSubtle,
        borderRadius: 16,
        padding: 4,
    },
    genderButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 12,
    },
    genderButtonSelected: {
        backgroundColor: colors.bg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    genderButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    genderButtonTextSelected: {
        color: colors.textPrimary,
    },
    recommendationsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12, // Added margin top to separate from input row
    },
    recommendationCard: {
        width: '48%', 
        backgroundColor: colors.surfaceSubtle,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    recommendationLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 4,
        color: colors.textSecondary,
    },
    recommendationValue: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    coachCard: {
      width: 160,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 24,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    coachCardSelected: {
      borderColor: colors.brandPrimary,
      backgroundColor: colors.bg,
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 12,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.border,
    },
    emojiBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    emojiText: {
      fontSize: 14,
    },
    coachName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 6,
    },
    coachDescription: {
      fontSize: 12,
      color: colors.textTertiary || colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    selectedBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: colors.brandPrimary,
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255,255,255,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 32,
    },
    attributeLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textSecondary,
        marginTop: 4,
    },
  })
