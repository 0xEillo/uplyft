import { LevelBadge } from '@/components/LevelBadge'
import { getLevelColor, type GroupLevelData } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import {
    getStrengthStandard,
    hasStrengthStandards
} from '@/lib/strength-standards'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
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
  groupData: GroupLevelData | null
  groupDisplayName: string
  profile: Profile | null
}

export function MuscleGroupDetailSheet({
  isVisible,
  onClose,
  groupData,
  groupDisplayName,
  profile,
}: MuscleGroupDetailSheetProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { formatWeight, weightUnit } = useWeightUnits()

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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Exercise List */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>
            {groupData.exercises.length} Exercise{groupData.exercises.length !== 1 ? 's' : ''} Tracked
          </Text>

          {groupData.exercises.map((exercise, index) => {
            const strengthInfo = getStrengthInfo(exercise.exerciseName, exercise.max1RM)

            return (
              <TouchableOpacity
                key={exercise.exerciseId}
                style={[
                  styles.exerciseCard,
                  index === groupData.exercises.length - 1 && styles.lastExerciseCard,
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
                      styles.levelBadge,
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
            )
          })}
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
    levelBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    levelText: {
      fontSize: 12,
      fontWeight: '700',
    },
  })
