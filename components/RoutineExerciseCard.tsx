import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import React, { useState } from 'react'
import {
    LayoutAnimation,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export interface RoutineExerciseSet {
  id: string
  setNumber: number
  repsMin: number | null
  repsMax: number | null
  restSeconds: number | null
}

export interface RoutineExerciseData {
  id: string
  exerciseId: string
  name: string
  gifUrl: string | null
  sets: RoutineExerciseSet[]
  orderIndex: number
}

interface RoutineExerciseCardProps {
  exercise: RoutineExerciseData
  onExercisePress?: (exerciseId: string) => void
  showSetDetails?: boolean
  defaultExpanded?: boolean
  /** When true, blurs the exercise name and details to tease content for non-pro users */
  locked?: boolean
}

/**
 * Reusable component for displaying a routine exercise with collapsible sets.
 * Tap the card to expand/collapse set details. Tap the exercise name to navigate.
 */
export function RoutineExerciseCard({
  exercise,
  onExercisePress,
  showSetDetails = true,
  defaultExpanded = false,
  locked = false,
}: RoutineExerciseCardProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const styles = createStyles(colors)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const formatReps = (min: number | null, max: number | null): string => {
    if (!min) return '-'
    if (max && max !== min) return `${min}-${max}`
    return `${min}`
  }

  const formatRestTime = (seconds: number | null): string => {
    if (!seconds) return '-'
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate summary for compact display
  const setCount = exercise.sets.length
  const firstSet = exercise.sets[0]
  const repsSummary = firstSet ? formatReps(firstSet.repsMin, firstSet.repsMax) : '-'

  const handleExercisePress = () => {
    if (onExercisePress) {
      onExercisePress(exercise.exerciseId)
    }
  }

  const handleToggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setIsExpanded(!isExpanded)
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.feedCardBackground }]}>
      {/* Exercise Header - Always visible */}
      <View style={styles.header}>
        {/* Thumbnail + Name - Tappable to navigate to exercise */}
        <TouchableOpacity 
          style={styles.exerciseInfoTouchable}
          onPress={handleExercisePress}
          activeOpacity={onExercisePress ? 0.7 : 1}
          disabled={!onExercisePress}
        >
          <View style={styles.imageContainer}>
            {exercise.gifUrl ? (
              <ExerciseMediaThumbnail
                gifUrl={exercise.gifUrl}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <View style={[styles.placeholder, { backgroundColor: colors.background }]}>
                <Ionicons name="barbell" size={20} color={colors.textSecondary} />
              </View>
            )}
          </View>
          <View style={styles.info}>
            {/* Always render the text, but overlay with BlurView if locked */}
            <View style={locked && styles.lockedTextContainer}>
              <Text
                style={[styles.name, { color: colors.primary }]}
                numberOfLines={1}
              >
                {exercise.name}
              </Text>
              <Text style={[styles.summary, { color: colors.textSecondary }]}>
                {setCount} {setCount === 1 ? 'set' : 'sets'} • {repsSummary} reps
              </Text>

              {locked && (
                <BlurView
                  intensity={60}
                  tint={isDark ? 'dark' : 'light'}
                  style={styles.blurOverlay}
                />
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Expand/Collapse Toggle - Hidden when locked */}
        {!locked && showSetDetails && exercise.sets.length > 0 && (
          <TouchableOpacity 
            style={styles.expandButton}
            onPress={handleToggleExpand}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name={isExpanded ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Detailed Set View - Collapsible - Hidden when locked */}
      {!locked && showSetDetails && isExpanded && exercise.sets.length > 0 && (
        <View style={styles.setsContainer}>
          <View style={styles.setHeader}>
            <Text style={[styles.colHeader, { color: colors.textSecondary, width: 40 }]}>
              SET
            </Text>
            <Text
              style={[
                styles.colHeader,
                { color: colors.textSecondary, flex: 1, textAlign: 'center' },
              ]}
            >
              REPS
            </Text>
            <Text
              style={[
                styles.colHeader,
                { color: colors.textSecondary, flex: 1, textAlign: 'center' },
              ]}
            >
              REST
            </Text>
          </View>
          {exercise.sets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={[styles.setNumber, { color: colors.warning }]}>
                {set.setNumber}
              </Text>
              <Text style={[styles.setValue, { color: colors.text }]}>
                {formatReps(set.repsMin, set.repsMax)}
              </Text>
              <Text style={[styles.setValue, { color: colors.text }]}>
                {formatRestTime(set.restSeconds)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    exerciseInfoTouchable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    imageContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      marginRight: 12,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    placeholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    summary: {
      fontSize: 13,
      fontWeight: '500',
    },
    expandButton: {
      padding: 8,
      marginLeft: 4,
    },
    setsContainer: {
      marginTop: 12,
      gap: 6,
    },
    setHeader: {
      flexDirection: 'row',
      marginBottom: 4,
      paddingHorizontal: 8,
    },
    colHeader: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    setRow: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 8,
      backgroundColor: 'rgba(0,0,0,0.02)',
      borderRadius: 8,
    },
    setNumber: {
      width: 40,
      fontWeight: '600',
    },
    setValue: {
      flex: 1,
      textAlign: 'center',
      fontWeight: '500',
    },
    lockedTextContainer: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 4,
    },
    blurOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
  })
