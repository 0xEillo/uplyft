import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { ExploreProgramWithRoutines } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

export default function ProgramDetailScreen() {
  const { programId } = useLocalSearchParams()
  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [program, setProgram] = useState<ExploreProgramWithRoutines | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])

  useEffect(() => {
    if (programId) {
      loadProgram(programId as string)
    }
  }, [programId])

  const loadProgram = async (id: string) => {
    try {
      const data = await database.explore.getProgramById(id)
      setProgram(data)
    } catch (error) {
      console.error('Error loading program:', error)
      Alert.alert('Error', 'Failed to load program details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveProgram = async () => {
    if (!user || !program) return

    try {
      setIsSaving(true)
      await database.explore.saveProgramToUser(program.id, user.id)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Success', 'Program saved to your workouts!', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (error) {
      console.error('Error saving program:', error)
      Alert.alert('Error', 'Failed to save program')
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

  if (!program) return null

  // Determine gradient based on display_order
  const GRADIENTS = [
    ['#2563EB', '#3B82F6'], // Blue
    ['#7C3AED', '#8B5CF6'], // Purple
    ['#EA580C', '#F97316'], // Orange
    ['#059669', '#10B981'], // Emerald
  ]
  const gradient = (GRADIENTS[
    (program.display_order - 1) % GRADIENTS.length
  ] || GRADIENTS[0]) as [string, string, ...string[]]

  // Determine icon
  let iconName = 'barbell'
  const nameLower = program.name.toLowerCase()
  if (nameLower.includes('body')) iconName = 'body'
  if (nameLower.includes('cardio') || nameLower.includes('hiit')) iconName = 'fitness'
  if (nameLower.includes('strength') || nameLower.includes('power')) iconName = 'flash'
  if (nameLower.includes('yoga') || nameLower.includes('stretch')) iconName = 'walk'

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
              <Text style={styles.headerTitle}>Program</Text>
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
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
             <View style={styles.iconBadge}>
               <Ionicons name={iconName as any} size={40} color="#FFF" />
             </View>
             <Text style={styles.programTitle}>{program.name}</Text>

          </LinearGradient>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSaveProgram}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Program</Text>
          )}
        </TouchableOpacity>

        {/* Description & Stats */}
        <View style={styles.infoSection}>
          <Text style={styles.description}>{program.description}</Text>
          
          <View style={styles.statsGrid}>

             <View style={styles.statItem}>
               <Ionicons name="fitness-outline" size={20} color={colors.textSecondary} />
               <Text style={styles.statLabel}>Gym</Text>
             </View>
             <View style={styles.statItem}>
               <Ionicons name="trophy-outline" size={20} color={colors.textSecondary} />
               <Text style={styles.statLabel}>{program.goal?.replace('_', ' ') || 'General'}</Text>
             </View>
             <View style={styles.statItem}>
               <Ionicons name="list-outline" size={20} color={colors.textSecondary} />
               <Text style={styles.statLabel}>{program.routine_count} Routines</Text>
             </View>
          </View>
        </View>

        {/* Routines List */}
        <View style={styles.routinesSection}>
          <Text style={styles.sectionTitle}>Routines</Text>
          {program.routines.map((routine) => (
            <View key={routine.id} style={styles.routineItem}>
              <View style={styles.routineHeader}>
                <Text style={styles.routineName}>{routine.name}</Text>
              </View>
              
              <Text style={styles.routineDescription}>
                {routine.description}
              </Text>

              {/* Exercises List */}
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
                   <Text style={{color: colors.textSecondary, fontStyle: 'italic', marginTop: 8}}>No exercises preview available</Text>
                )}
              </View>

            </View>
          ))}
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
    headerGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    iconBadge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    programTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: '#FFF',
      textAlign: 'center',
      marginBottom: 8,
      textShadowColor: 'rgba(0,0,0,0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    programLevel: {
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
      width: '45%',
    },
    statLabel: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
      textTransform: 'capitalize',
    },
    routinesSection: {
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    routineItem: {
      marginBottom: 32,
    },
    routineHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    routineName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    routineDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
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
