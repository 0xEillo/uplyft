import { EmptyState } from '@/components/EmptyState'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LevelBadge } from '@/components/LevelBadge'
import { getLevelColor, type MuscleGroupData } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { BODY_PART_TO_DATABASE_MUSCLE, BodyPartSlug } from '@/lib/body-mapping'
import { getTrackableExercisesForMuscle } from '@/lib/exercise-standards-config'
import {
    getStrengthStandard,
    hasStrengthStandards
} from '@/lib/strength-standards'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface MuscleGroupDetailSheetProps {
  isVisible: boolean
  onClose: () => void
  groupData: MuscleGroupData | null
  groupDisplayName: string
  bodyPartSlug: BodyPartSlug | null
  profile: Profile | null
}

export function MuscleGroupDetailSheet({
  isVisible,
  onClose,
  groupData,
  groupDisplayName,
  bodyPartSlug,
  profile,
}: MuscleGroupDetailSheetProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { formatWeight, weightUnit } = useWeightUnits()

  const filteredExercises = useMemo(() => {
    if (!groupData) return [];
    if (!bodyPartSlug) return groupData.exercises;

    const targetMuscle = BODY_PART_TO_DATABASE_MUSCLE[bodyPartSlug];
    if (!targetMuscle) return groupData.exercises;

    return groupData.exercises.filter((exercise) => {
      // Direct match between exercise muscle group and tap target
      return exercise.muscleGroup === targetMuscle;
    });
  }, [groupData, bodyPartSlug]);

  const allMuscleExercises = useMemo(() => {
    const getStrengthInfo = (exerciseName: string, max1RM: number) => {
      if (!profile?.gender || !profile?.weight_kg) {
        return null
      }

      if (!hasStrengthStandards(exerciseName)) {
        return null
      }

      return getStrengthStandard(
        exerciseName,
        profile.gender as 'male' | 'female',
        profile.weight_kg,
        max1RM,
      )
    }

    if (!bodyPartSlug) return []
    const dbMuscle = BODY_PART_TO_DATABASE_MUSCLE[bodyPartSlug]
    if (!dbMuscle) return []
    
    const trackableConfigs = getTrackableExercisesForMuscle(dbMuscle)
    
    return trackableConfigs.map(config => {
      const userExercise = filteredExercises.find(ex => ex.exerciseName === config.name)
      
      return {
        exerciseId: userExercise?.exerciseId || config.id,
        exerciseName: config.name,
        gifUrl: userExercise?.gifUrl || config.gifUrl || null,
        max1RM: userExercise?.max1RM || 0,
        isDone: !!userExercise,
        strengthInfo: userExercise ? getStrengthInfo(config.name, userExercise.max1RM) : null
      }
    }).sort((a, b) => {
      // Done first, then alphabetical
      if (a.isDone && !b.isDone) return -1
      if (!a.isDone && b.isDone) return 1
      return a.exerciseName.localeCompare(b.exerciseName)
    })
  }, [bodyPartSlug, filteredExercises, profile?.gender, profile?.weight_kg])

  const navigateToExercise = (exerciseId: string) => {
    onClose()
    router.push({
      pathname: '/exercise/[exerciseId]',
      params: { exerciseId },
    })
  }

  const styles = createStyles(colors)

  if (!groupData) return null

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>{groupDisplayName}</Text>
              <LevelBadge level={groupData.level} size="small" showTooltipOnPress={false} />
            </View>
            <Text style={styles.progressText}>
              {Math.round(groupData.progress)}% to next level
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Exercise List */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>
            Exercises & Standards
          </Text>

          {allMuscleExercises.length === 0 ? (
            <EmptyState
              icon="body-outline"
              title="No exercises available"
              description={`We don't have any tracked exercises for ${groupDisplayName} yet.`}
            />
          ) : (
            allMuscleExercises.map((exercise, index) => (
              <TouchableOpacity
                key={exercise.exerciseId || exercise.exerciseName}
                style={[
                  styles.exerciseCard,
                  !exercise.isDone && styles.untrackedCard,
                  index === allMuscleExercises.length - 1 && styles.lastExerciseCard,
                ]}
                onPress={() => exercise.exerciseId && navigateToExercise(exercise.exerciseId)}
                activeOpacity={0.7}
                disabled={!exercise.exerciseId}
              >
                <View style={styles.exerciseLeft}>
                  <View style={styles.thumbnailContainer}>
                    <ExerciseMediaThumbnail
                      gifUrl={exercise.gifUrl}
                      style={StyleSheet.flatten([styles.exerciseThumbnail, !exercise.isDone && styles.untrackedThumbnail]) as ViewStyle}
                    />
                    {!exercise.isDone && (
                      <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={14} color="#FFF" />
                      </View>
                    )}
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, !exercise.isDone && styles.untrackedText]}>
                      {exercise.exerciseName}
                    </Text>
                    {exercise.isDone ? (
                      <Text style={styles.exerciseWeight}>
                        Est. 1RM: {formatWeight(exercise.max1RM, {
                          maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                        })}
                      </Text>
                    ) : (
                      <Text style={styles.exerciseStatus}>Not yet tracked</Text>
                    )}
                  </View>
                </View>

                <View style={styles.exerciseRight}>
                  {exercise.strengthInfo && (
                    <View style={[
                      styles.levelBadgeItem,
                      { backgroundColor: getLevelColor(exercise.strengthInfo.level) + '20' }
                    ]}>
                      <Text style={[
                        styles.levelText,
                        { color: getLevelColor(exercise.strengthInfo.level) }
                      ]}>
                        {exercise.strengthInfo.level}
                      </Text>
                    </View>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textTertiary}
                  />
                </View>
              </TouchableOpacity>
            ))
          )}

          <View style={styles.infoFooter}>
            <Ionicons name="shield-checkmark" size={14} color={colors.textTertiary} />
            <Text style={styles.infoFooterText}>
              Levels based on global strength standards
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      backgroundColor: colors.background,
      padding: 20,
      paddingTop: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 6,
    },
    progressText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    closeButton: {
      padding: 4,
    },
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 16,
      letterSpacing: -0.2,
    },
    exerciseCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.feedCardBackground,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    lastExerciseCard: {
      marginBottom: 0,
    },
    exerciseLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    exerciseThumbnail: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: '#f0f0f0', // Keep light background for white GIFs even in dark mode
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
      letterSpacing: -0.4,
    },
    exerciseWeight: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    exerciseRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    levelBadgeItem: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    levelText: {
      fontSize: 12,
      fontWeight: '700',
    },
    untrackedCard: {
      backgroundColor: colors.background,
    },
    thumbnailContainer: {
      position: 'relative',
    },
    untrackedThumbnail: {
    },
    lockOverlay: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      backgroundColor: colors.textTertiary,
      borderRadius: 10,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    untrackedText: {
      color: colors.textSecondary,
    },
    exerciseStatus: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    infoFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 32,
      opacity: 0.8,
    },
    infoFooterText: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: '500',
    },
  })
