import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { COACH_OPTIONS, CoachId } from '@/lib/coaches'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CoachSelectionScreen() {
  const { user } = useAuth()
  const { profile, isLoading, updateProfile } = useProfile()
  const router = useRouter()
  const colors = useThemedColors()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleSelectCoach = async (coachId: CoachId) => {
    if (!user || !profile) return
    if (profile.coach === coachId) return

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

  const styles = createStyles(colors)

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <BaseNavbar
          leftContent={
            <NavbarIsland>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={
            <Text style={styles.headerTitle}>AI Personal Trainer</Text>
          }
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={
          <NavbarIsland>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          </NavbarIsland>
        }
        centerContent={
          <Text style={styles.headerTitle}>AI Personal Trainer</Text>
        }
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Personal Trainer</Text>

        <View style={styles.card}>
          {COACH_OPTIONS.map((coach, index) => {
            const isSelected = profile?.coach === coach.id
            const isLast = index === COACH_OPTIONS.length - 1

            return (
              <TouchableOpacity
                key={coach.id}
                style={[
                  styles.coachRow,
                  !isLast && styles.coachRowBorder,
                ]}
                onPress={() => handleSelectCoach(coach.id)}
                disabled={isUpdating}
                activeOpacity={0.7}
              >
                <View style={styles.coachInfo}>
                  <View style={styles.avatarContainer}>
                    <Image source={coach.image} style={styles.avatar} />
                    {/* Emoji badge based on coach type could go here if we had data for it */}
                    {/* For now just showing the image as per design */}
                    <View style={styles.emojiBadge}>
                        {coach.id === 'kino' && <Text style={styles.emojiText}>👊</Text>}
                        {coach.id === 'maya' && <Text style={styles.emojiText}>👏</Text>}
                        {coach.id === 'ross' && <Text style={styles.emojiText}>📋</Text>}
                    </View>
                  </View>
                  <View style={styles.coachText}>
                    <Text style={styles.coachName}>{coach.name}</Text>
                    <Text style={styles.coachDescription} numberOfLines={2}>
                      {coach.description}
                    </Text>
                  </View>
                </View>
                
                {isSelected && (
                  <Ionicons name="checkmark" size={20} color={colors.success} />
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButton: {
      padding: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 12,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 16,
      overflow: 'hidden',
    },
    coachRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.backgroundWhite,
    },
    coachRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    coachInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.border,
    },
    emojiBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      backgroundColor: colors.backgroundWhite,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.backgroundWhite,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
      elevation: 1,
    },
    emojiText: {
      fontSize: 12,
    },
    coachName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    coachText: {
      flex: 1,
    },
    coachDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  })
