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
import { useMemo, useState } from 'react'
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

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
  const [showInfo, setShowInfo] = useState(false)

  const trackableExercises = useMemo(() => {
    if (!bodyPartSlug) return []
    const dbMuscle = BODY_PART_TO_DATABASE_MUSCLE[bodyPartSlug]
    if (!dbMuscle) return []
    return getTrackableExercisesForMuscle(dbMuscle)
  }, [bodyPartSlug])

  const untrackedExercises = useMemo(() => {
    const trackedNames = new Set(groupData?.exercises.map(e => e.exerciseName) || [])
    return trackableExercises.filter((name: string) => !trackedNames.has(name))
  }, [trackableExercises, groupData])

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
            <TouchableOpacity 
              onPress={() => setShowInfo(!showInfo)} 
              style={[styles.infoButton, showInfo && styles.infoButtonActive]}
            >
              <Ionicons 
                name={showInfo ? "information-circle" : "information-circle-outline"} 
                size={22} 
                color={showInfo ? colors.primary : colors.textSecondary} 
              />
            </TouchableOpacity>
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
          {showInfo ? (
            <View style={styles.infoView}>
              <Text style={styles.sectionTitle}>Trackable Exercises</Text>
              <View style={styles.trackableList}>
                {trackableExercises.map((name: string) => {
                  const isTracked = groupData?.exercises.some(e => e.exerciseName === name);
                  return (
                    <View key={name} style={styles.trackableItem}>
                      <View style={styles.trackableIcon}>
                        <Ionicons 
                          name={isTracked ? "checkmark-circle" : "add-circle-outline"} 
                          size={20} 
                          color={isTracked ? colors.success : colors.primary} 
                        />
                      </View>
                      <View style={styles.trackableItemContent}>
                        <Text style={[styles.trackableName, isTracked && styles.trackableNameActive]}>
                          {name}
                        </Text>
                        <Text style={styles.trackableStatus}>
                          {isTracked ? 'Successfully Tracked' : 'Not Tracked Yet'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {filteredExercises.length} Exercise{filteredExercises.length !== 1 ? 's' : ''} Tracked
              </Text>

              {filteredExercises.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="fitness" size={32} color={colors.textTertiary} />
                  </View>
                  <Text style={styles.emptyTitle}>No Data Found</Text>
                  <Text style={styles.emptyText}>
                    You haven't logged any compatible {groupDisplayName} exercises yet.
                  </Text>
                  
                  <TouchableOpacity 
                    style={styles.learnMoreButton}
                    onPress={() => setShowInfo(true)}
                  >
                    <Text style={styles.learnMoreButtonText}>See Trackable Exercises</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ) : (
                filteredExercises.map((exercise, index) => {
                  const strengthInfo = getStrengthInfo(exercise.exerciseName, exercise.max1RM)

                  return (
                    <TouchableOpacity
                      key={exercise.exerciseId}
                      style={[
                        styles.exerciseCard,
                        index === filteredExercises.length - 1 && styles.lastExerciseCard,
                      ]}
                      onPress={() => navigateToExercise(exercise.exerciseId)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                        <Text style={styles.exerciseWeight}>
                          Est. 1RM: {formatWeight(exercise.max1RM, {
                            maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                          })}
                        </Text>
                      </View>

                      <View style={styles.exerciseRight}>
                        {strengthInfo && (
                          <View style={[
                            styles.levelBadgeItem,
                            { backgroundColor: getLevelColor(strengthInfo.level) + '20' }
                          ]}>
                            <Text style={[
                              styles.levelText,
                              { color: getLevelColor(strengthInfo.level) }
                            ]}>
                              {strengthInfo.level}
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
                  );
                })
              )}
            </>
          )}
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
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
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
      fontWeight: '700',
      color: colors.text,
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
      fontWeight: '500',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    infoButton: {
      padding: 8,
      borderRadius: 12,
    },
    infoButtonActive: {
      backgroundColor: colors.primary + '15',
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
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 16,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    exerciseCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.feedCardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
    },
    lastExerciseCard: {
      marginBottom: 0,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    exerciseWeight: {
      fontSize: 14,
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
    emptyContainer: {
      padding: 40,
      paddingTop: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    learnMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 20,
      backgroundColor: colors.primary + '10',
    },
    learnMoreButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    infoView: {
      flex: 1,
    },
    trackableList: {
      backgroundColor: colors.feedCardBackground,
      borderRadius: 16,
      overflow: 'hidden',
    },
    trackableItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 16,
    },
    trackableIcon: {
      width: 24,
      alignItems: 'center',
    },
    trackableItemContent: {
      flex: 1,
    },
    trackableName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    trackableNameActive: {
      color: colors.text,
    },
    trackableStatus: {
      fontSize: 12,
      color: colors.textPlaceholder,
      marginTop: 2,
    },
  })
