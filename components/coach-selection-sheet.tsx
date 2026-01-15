import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { COACH_OPTIONS, CoachId } from '@/lib/coaches'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
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

export function CoachSelectionSheet({ visible, onClose }: CoachSelectionSheetProps) {
  const { profile, updateProfile } = useProfile()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const [isUpdating, setIsUpdating] = React.useState(false)

  const handleSelectCoach = async (coachId: CoachId) => {
    haptic('light')
    if (profile?.coach === coachId) {
      onClose()
      return
    }

    try {
      setIsUpdating(true)
      await updateProfile({ coach: coachId })
      onClose()
    } catch (error) {
      console.error('Error updating coach:', error)
      Alert.alert('Error', 'Unable to update coach. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const styles = createStyles(colors, insets)

  const sheetContent = (
    <View style={styles.sheetContent}>
      <View style={styles.header}>
        <View style={styles.handle} />
        <Text style={styles.title}>Change AI Coach</Text>
        <Text style={styles.subtitle}>Choose your training personality</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.grid}>
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
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {isUpdating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
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
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheetContainer}>
          {sheetContent}
        </View>
      </TouchableOpacity>
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
      backgroundColor: colors.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      maxHeight: '70%',
      width: '100%',
      paddingBottom: insets.bottom + 20,
    },
    sheetContent: {
      width: '100%',
    },
    header: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 20,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
    },
    coachCard: {
      width: '48%',
      backgroundColor: colors.backgroundLight,
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
      borderColor: colors.primary,
      backgroundColor: colors.background,
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
      backgroundColor: colors.backgroundWhite,
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.backgroundWhite,
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
      color: colors.text,
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
      backgroundColor: colors.primary,
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
  })
