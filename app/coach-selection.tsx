import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { COACH_OPTIONS, CoachId } from '@/lib/coaches'
import { database } from '@/lib/database'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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
  const router = useRouter()
  const colors = useThemedColors()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  const loadProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const data = await database.profiles.getByIdOrNull(user.id)
      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const handleSelectCoach = async (coachId: CoachId) => {
    if (!user || !profile) return
    if (profile.coach === coachId) return

    try {
      setIsUpdating(true)
      // Optimistic update
      setProfile({ ...profile, coach: coachId })
      
      const updated = await database.profiles.update(user.id, {
        coach: coachId,
      })
      setProfile(updated)
    } catch (error) {
      console.error('Error updating coach:', error)
      Alert.alert('Error', 'Unable to update coach. Please try again.')
      // Revert optimistic update
      loadProfile()
    } finally {
      setIsUpdating(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

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
                  <Text style={styles.coachName}>{coach.name}</Text>
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

const createStyles = (colors: any) =>
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
      fontSize: 22,
      fontWeight: '700',
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
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    coachRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.surface,
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
      backgroundColor: colors.surface,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.surface,
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
    },
  })
