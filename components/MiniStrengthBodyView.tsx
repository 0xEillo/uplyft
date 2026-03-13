import { BodyHighlighterDual } from '@/components/BodyHighlighterDual'
import { LevelBadge } from '@/components/LevelBadge'
import { useTheme } from '@/contexts/theme-context'
import type { ExerciseData, MuscleGroupData } from '@/hooks/useStrengthData'
import { getLevelIntensity } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  BODY_PART_DISPLAY_NAMES,
  BODY_PART_TO_DATABASE_MUSCLE,
  type BodyPartSlug,
} from '@/lib/body-mapping'
import {
  buildSpecificMuscleGroupData,
} from '@/lib/strength-display-groups'
import { loadStrengthScoreDeltaContext } from '@/lib/strength-score-delta'
import {
  type StrengthLevel,
} from '@/lib/strength-standards'
import type { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'

const SCREEN_WIDTH = Dimensions.get('window').width
const SCALE = 0.55
const BODY_FULL_HEIGHT = 360
const MINI_HEIGHT = BODY_FULL_HEIGHT * SCALE

function useMiniStrengthData(userId: string) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [exerciseData, setExerciseData] = useState<ExerciseData[]>([])
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const ctx = await loadStrengthScoreDeltaContext(userId)
        if (cancelled) return
        setProfile(ctx.profile)
        const sorted = [...ctx.exercises].sort(
          (a, b) => b.max1RM - a.max1RM,
        ) as ExerciseData[]
        setExerciseData(sorted)

        if (ctx.profile?.weight_kg && ctx.strengthGender && sorted.length > 0) {
          setMuscleGroups(
            buildSpecificMuscleGroupData({
              gender: ctx.strengthGender,
              bodyweightKg: ctx.profile.weight_kg,
              exercises: sorted,
            }),
          )
        } else {
          setMuscleGroups([])
        }
      } catch (err) {
        console.error('Error loading mini strength data:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  return {
    profile,
    muscleGroups,
    isLoading,
    hasData: exerciseData.length > 0,
  }
}

interface MiniStrengthBodyCardProps {
  userId: string
  width: number
  showChevron?: boolean
  onChevronPress?: () => void
}

export function MiniStrengthBodyCard({
  userId,
  width: cardWidth,
  showChevron = true,
  onChevronPress,
}: MiniStrengthBodyCardProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const router = useRouter()
  const { profile, muscleGroups, isLoading, hasData } = useMiniStrengthData(userId)

  const bodyGender: 'male' | 'female' =
    profile?.gender === 'female' ? 'female' : 'male'

  const bodyColors = useMemo(() => {
    const baseColor = isDark ? '#2A2A2A' : '#4A4A4A'
    return [
      baseColor,
      '#9CA3AF',
      '#3B82F6',
      '#10B981',
      '#8B5CF6',
      '#F59E0B',
      '#EF4444',
    ]
  }, [isDark])

  const bodyData = useMemo(() => {
    const data: { slug: BodyPartSlug; intensity: number }[] = []
    const muscleMap = new Map<string, MuscleGroupData>()
    muscleGroups.forEach((mg) => muscleMap.set(mg.name, mg))

    Object.entries(BODY_PART_TO_DATABASE_MUSCLE).forEach(
      ([slug, dbMuscleName]) => {
        const mgData = muscleMap.get(dbMuscleName)
        if (mgData) {
          data.push({
            slug: slug as BodyPartSlug,
            intensity: getLevelIntensity(mgData.level),
          })
        }
      },
    )

    return data
  }, [muscleGroups])

  const handleBodyPartPress = useCallback(
    (bodyPart: { slug?: string }) => {
      if (!bodyPart.slug) return

      const slug = bodyPart.slug as BodyPartSlug
      const dbMuscleName = BODY_PART_TO_DATABASE_MUSCLE[slug]
      if (!dbMuscleName) return

      const mgData = muscleGroups.find((mg) => mg.name === dbMuscleName)
      const displayName = BODY_PART_DISPLAY_NAMES[slug] ?? slug

      const groupData: MuscleGroupData = mgData || {
        name: dbMuscleName,
        level: 'Beginner',
        progress: 0,
        averageScore: 0,
        exercises: [],
      }

      router.push({
        pathname: '/muscle-group-detail',
        params: {
          groupDisplayName: displayName,
          bodyPartSlug: slug,
          groupDataJson: JSON.stringify(groupData),
        },
      })
    },
    [muscleGroups, router],
  )

  const styles = useMemo(() => createStyles(colors), [colors])

  if (isLoading) {
    return (
      <View style={[styles.container, { width: cardWidth }]}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    )
  }

  if (!hasData) return null

  return (
    <View style={[styles.container, { width: cardWidth }]}>
      <View style={styles.bodyRow}>
        <View style={styles.bodyContent}>
          <View style={styles.bodyContainer}>
            <View style={styles.bodyScaler}>
              <BodyHighlighterDual
                bodyData={bodyData}
                gender={bodyGender}
                colors={bodyColors}
                onBodyPartPress={handleBodyPartPress}
              />
            </View>
          </View>
          <View style={styles.legendRow}>
            {(
              [
                'Beginner',
                'Novice',
                'Intermediate',
                'Advanced',
                'Elite',
                'World Class',
              ] as StrengthLevel[]
            ).map((level) => (
              <LevelBadge
                key={level}
                level={level}
                variant="pill"
                size="small"
              />
            ))}
          </View>
        </View>
        {showChevron && (
          <TouchableOpacity
            style={styles.chevronHint}
            onPress={onChevronPress}
            hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
            activeOpacity={0.5}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    bodyRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    bodyContent: {
      flex: 1,
    },
    bodyContainer: {
      height: MINI_HEIGHT,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bodyScaler: {
      width: SCREEN_WIDTH,
      transform: [{ scale: SCALE }],
      marginTop: -(BODY_FULL_HEIGHT * (1 - SCALE)) / 2,
      marginBottom: -(BODY_FULL_HEIGHT * (1 - SCALE)) / 2,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginTop: 4,
    },
    chevronHint: {
      position: 'absolute',
      right: 0,
      top: '35%',
      opacity: 0.5,
    },
  })
