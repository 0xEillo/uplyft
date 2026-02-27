import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { useState } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

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
  /** When true, renders without bottom margin (for use inside a parent list container) */
  asRow?: boolean
  /** When asRow is true, suppresses the bottom separator on the last item */
  isLast?: boolean
}

/**
 * Reusable component for displaying a routine exercise with collapsible sets.
 * Visual language matches workout-card: rounded-square thumb, textPrimary name,
 * numbered badge + inline set details on expand.
 */
export function RoutineExerciseCard({
  exercise,
  onExercisePress,
  showSetDetails = true,
  defaultExpanded = false,
  locked = false,
  asRow = false,
  isLast = false,
}: RoutineExerciseCardProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const styles = createStyles(colors, isDark)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const formatReps = (min: number | null, max: number | null): string => {
    if (!min) return '-'
    if (max && max !== min) return `${min}–${max}`
    return `${min}`
  }

  const formatRest = (seconds: number | null): string => {
    if (!seconds) return ''
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s > 0 ? `${s}s` : ''}rest`.trim() : `${s}s rest`
  }

  const setCount = exercise.sets.length
  const canExpand = !locked && showSetDetails && setCount > 0
  const canNavigate = !!onExercisePress

  return (
    <View style={[styles.card, asRow && styles.cardAsRow, asRow && isLast && styles.cardAsRowLast]}>
      {/* Header row – always visible */}
      <View style={styles.header}>
        {/* Thumbnail */}
        <TouchableOpacity
          style={[styles.thumb, !exercise.gifUrl && styles.thumbFallback]}
          onPress={() => onExercisePress?.(exercise.exerciseId)}
          disabled={!canNavigate}
          activeOpacity={canNavigate ? 0.7 : 1}
        >
          {exercise.gifUrl ? (
            <ExerciseMediaThumbnail
              gifUrl={exercise.gifUrl}
              style={styles.thumbImage}
            />
          ) : (
            <Ionicons
              name="barbell"
              size={18}
              color={isDark ? 'rgba(255,255,255,0.38)' : colors.textTertiary}
            />
          )}
        </TouchableOpacity>

        {/* Name + meta */}
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <TouchableOpacity
              onPress={() => onExercisePress?.(exercise.exerciseId)}
              disabled={!canNavigate}
              activeOpacity={canNavigate ? 0.7 : 1}
              style={styles.nameTouch}
            >
              {locked ? (
                <View style={styles.lockedTextWrap}>
                  <Text style={styles.name} numberOfLines={1}>
                    {exercise.name}
                  </Text>
                  <BlurView
                    intensity={55}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              ) : (
                <Text style={styles.name} numberOfLines={1}>
                  {exercise.name}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.meta}>
              {!locked && (
                <Text style={styles.setCountText}>{setCount} sets</Text>
              )}
              {canExpand && (
                <TouchableOpacity
                  onPress={() => setIsExpanded((v) => !v)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.chevron}
                >
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={
                      isDark ? 'rgba(255,255,255,0.28)' : colors.textTertiary
                    }
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Expanded set detail */}
      {isExpanded && canExpand && (
        <View style={styles.setsContainer}>
          {exercise.sets.map((set) => {
            const restStr = formatRest(set.restSeconds)
            return (
              <View key={set.id} style={styles.setRow}>
                <View style={styles.setBadge}>
                  <Text style={styles.setBadgeText}>{set.setNumber}</Text>
                </View>
                <Text style={styles.setDetail}>
                  {formatReps(set.repsMin, set.repsMax)} reps
                  {restStr ? (
                    <Text style={styles.setDetailMuted}> · {restStr}</Text>
                  ) : null}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    card: {
      borderRadius: 16,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(0,0,0,0.025)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      padding: 12,
      marginBottom: 10,
    },
    cardAsRow: {
      borderRadius: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginBottom: 0,
    },
    cardAsRowLast: {},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: 12,
      overflow: 'hidden',
      flexShrink: 0,
    },
    thumbFallback: {
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.06)'
        : colors.surfaceSubtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    content: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    nameTouch: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? 'rgba(255,255,255,0.88)' : colors.textPrimary,
      letterSpacing: -0.1,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    setCountText: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary,
    },
    chevron: {
      padding: 2,
    },
    setsContainer: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark
        ? 'rgba(255,255,255,0.07)'
        : 'rgba(0,0,0,0.05)',
      gap: 7,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    setBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.1)'
        : colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
    },
    setBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary,
    },
    setDetail: {
      fontSize: 13,
      color: isDark ? 'rgba(255,255,255,0.62)' : colors.textSecondary,
      fontWeight: '400',
    },
    setDetailMuted: {
      color: isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary,
    },
    lockedTextWrap: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 4,
    },
  })
