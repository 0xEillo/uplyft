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

  const STRENGTH_LEVEL_INFO = [
    { level: 'Beginner', description: 'Just starting out. Your focus is on learning proper form and building a baseline.' },
    { level: 'Novice', description: 'A few months in. You have graduated from the basics and are seeing steady linear gains.' },
    { level: 'Intermediate', description: '1–2 years of consistent work. You have reached a solid level of strength that requires a structured program to advance.' },
    { level: 'Advanced', description: '2–5 years of dedicated training. Your strength is well above average and progress requires high precision.' },
    { level: 'Elite', description: 'Top tier competitive strength. You are performing at the level of a high-end regional powerlifter or weightlifter.' },
    { level: 'World Class', description: 'The pinnacle. Your strength levels are comparable to international record-holders and world champions.' },
  ] as const;

  const trackableExercises = useMemo(() => {
    if (!bodyPartSlug) return []
    const dbMuscle = BODY_PART_TO_DATABASE_MUSCLE[bodyPartSlug]
    if (!dbMuscle) return []
    return getTrackableExercisesForMuscle(dbMuscle)
  }, [bodyPartSlug])

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
              <Text style={styles.sectionTitle}>About Strength Levels</Text>
              <Text style={styles.infoDescription}>
                Levels are calculated based on your one-rep max relative to your gender and bodyweight.
              </Text>
              
              <View style={styles.levelsList}>
                {STRENGTH_LEVEL_INFO.map((info) => (
                  <View key={info.level} style={styles.levelInfoCard}>
                    <View style={styles.levelInfoHeader}>
                      <View style={[styles.levelIndicator, { backgroundColor: getLevelColor(info.level as any) }]} />
                      <Text style={styles.levelInfoTitle}>{info.level}</Text>
                    </View>
                    <Text style={styles.levelInfoDescription}>{info.description}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.infoFooter}>
                <Ionicons name="shield-checkmark" size={16} color={colors.textTertiary} />
                <Text style={styles.infoFooterText}>
                  Based on global standards for drug-free athletes.
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {filteredExercises.length} Exercise{filteredExercises.length !== 1 ? 's' : ''} Tracked
              </Text>

              {filteredExercises.length === 0 ? (
                <EmptyState
                  icon="body-outline"
                  title="No exercises tracked"
                  description={`You haven't logged any ${groupDisplayName} exercises that match our strength standards yet.`}
                  buttonText="Log Your First Workout"
                  onPress={() => {
                    onClose()
                    router.push('/(tabs)/create-post')
                  }}
                />
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
                      <View style={styles.exerciseLeft}>
                        <ExerciseMediaThumbnail
                          gifUrl={exercise.gifUrl}
                          style={styles.exerciseThumbnail}
                        />
                        <View style={styles.exerciseInfo}>
                          <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                          <Text style={styles.exerciseWeight}>
                            Est. 1RM: {formatWeight(exercise.max1RM, {
                              maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                            })}
                          </Text>
                        </View>
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
    emptyContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    emptyButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    infoView: {
      flex: 1,
    },
    infoDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 24,
    },
    levelsList: {
      gap: 12,
    },
    levelInfoCard: {
      backgroundColor: colors.feedCardBackground,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    levelInfoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 6,
    },
    levelIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    levelInfoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    levelInfoDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
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
