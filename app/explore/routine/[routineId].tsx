import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { ExploreRoutineWithExercises } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

export default function ExploreRoutineDetailScreen() {
  const { routineId } = useLocalSearchParams()
  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [routine, setRoutine] = useState<ExploreRoutineWithExercises | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])

  useEffect(() => {
    if (routineId) {
      loadRoutine(routineId as string)
    }
  }, [routineId])

  const loadRoutine = async (id: string) => {
    try {
      const data = await database.explore.getRoutineById(id)
      setRoutine(data)
    } catch (error) {
      console.error('Error loading routine:', error)
      Alert.alert('Error', 'Failed to load routine details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveRoutine = async () => {
    if (!user || !routine) return

    try {
      setIsSaving(true)
      await database.explore.saveRoutineToUser(routine.id, user.id)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Success', 'Routine saved to your workouts!', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (error) {
      console.error('Error saving routine:', error)
      Alert.alert('Error', 'Failed to save routine')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExercisePress = (exerciseId: string) => {
    router.push({
      pathname: '/exercise/[exerciseId]',
      params: { exerciseId }
    })
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!routine) return null

  return (
    <View style={styles.container}>
      <View style={[styles.navbarContainer, { paddingTop: insets.top }]}>
        <BaseNavbar
          leftContent={
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          }
          centerContent={
            <NavbarIsland>
              <Text style={styles.headerTitle}>Routine</Text>
            </NavbarIsland>
          }
          rightContent={
             <TouchableOpacity style={styles.shareButton}>
               <Ionicons name="share-outline" size={24} color={colors.text} />
             </TouchableOpacity>
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          {routine.image_url ? (
            <Image 
              source={{ uri: routine.image_url }} 
              style={styles.headerImage} 
            />
          ) : (
            <LinearGradient
              colors={['#2563EB', '#3B82F6']}
              style={styles.headerGradient}
            >
              <Ionicons name="fitness" size={48} color="#FFF" />
            </LinearGradient>
          )}
          <LinearGradient
             colors={['transparent', 'rgba(0,0,0,0.8)']}
             style={styles.headerOverlay}
          />
          <View style={styles.headerContent}>
             <Text style={styles.routineTitle}>{routine.name}</Text>

          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSaveRoutine}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Routine</Text>
          )}
        </TouchableOpacity>

        {/* Description & Stats */}
        <View style={styles.infoSection}>
          <Text style={styles.description}>{routine.description}</Text>
          
          <View style={styles.statsGrid}>
             <View style={styles.statItem}>
               <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
               <Text style={styles.statLabel}>{routine.duration_minutes || '?'} min</Text>
             </View>

             <View style={styles.statItem}>
               <Ionicons name="list-outline" size={20} color={colors.textSecondary} />
               <Text style={styles.statLabel}>{routine.exercises?.length || 0} Exercises</Text>
             </View>
          </View>
        </View>

        {/* Exercises List */}
        <View style={styles.exercisesSection}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <View style={styles.exerciseList}>
            {routine.exercises?.map((exItem) => (
              <TouchableOpacity 
                key={exItem.id} 
                style={styles.exerciseRow}
                onPress={() => exItem.exercise && handleExercisePress(exItem.exercise.id)}
                activeOpacity={0.7}
              >
                <View style={styles.exerciseImageContainer}>
                  {exItem.exercise?.gif_url ? (
                    <ExerciseMediaThumbnail 
                       gifUrl={exItem.exercise.gif_url}
                       style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <View style={styles.exercisePlaceholder}>
                       <Ionicons name="barbell" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                </View>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName} numberOfLines={1}>{exItem.exercise?.name || 'Unknown Exercise'}</Text>
                  <Text style={styles.exerciseDetails}>
                    {exItem.sets} sets • {exItem.reps_min}{exItem.reps_max ? `-${exItem.reps_max}` : ''} reps
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
             {(!routine.exercises || routine.exercises.length === 0) && (
                   <Text style={{color: colors.textSecondary, fontStyle: 'italic', marginTop: 8}}>No exercises found</Text>
             )}
          </View>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    navbarContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    shareButton: {
      padding: 8,
      marginRight: -8,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    scrollContent: {
      // styles
    },
    headerCard: {
      margin: 16,
      height: 220,
      borderRadius: 24,
      overflow: 'hidden',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    headerImage: {
      width: '100%',
      height: '100%',
    },
    headerGradient: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '100%',
    },
    headerContent: {
      position: 'absolute',
      bottom: 24,
      left: 24,
      right: 24,
    },
    routineTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: '#FFF',
      marginBottom: 8,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    routineLevel: {
      fontSize: 14,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: 1,
    },
    saveButton: {
      backgroundColor: colors.primary,
      marginHorizontal: 16,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    saveButtonText: {
      color: '#FFF',
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    infoSection: {
      paddingHorizontal: 16,
      marginBottom: 32,
    },
    description: {
      fontSize: 16,
      color: colors.text,
      lineHeight: 24,
      marginBottom: 24,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: '30%',
    },
    statLabel: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '500',
      textTransform: 'capitalize',
    },
    exercisesSection: {
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    exerciseList: {
      gap: 12,
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.feedCardBackground,
      padding: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exerciseImageContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    exercisePlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 2,
    },
    exerciseDetails: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
  })
