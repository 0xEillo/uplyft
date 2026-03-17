import { getColors } from '@/constants/colors'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Body from '../PatchedBodyHighlighter'
import { BodyPartSlug } from '@/lib/body-mapping'

interface MuscleBodyMapping {
  slug: BodyPartSlug
  side: 'front' | 'back'
}

const MUSCLE_TO_BODY_PARTS: Record<string, MuscleBodyMapping> = {
  Chest: { slug: 'chest', side: 'front' },
  Shoulders: { slug: 'deltoids', side: 'front' },
  Triceps: { slug: 'triceps', side: 'back' },
  Biceps: { slug: 'biceps', side: 'front' },
  Back: { slug: 'upper-back', side: 'back' },
  Lats: { slug: 'upper-back', side: 'back' },
  Traps: { slug: 'trapezius', side: 'back' },
  Abs: { slug: 'abs', side: 'front' },
  Core: { slug: 'abs', side: 'front' },
  'Lower Back': { slug: 'lower-back', side: 'back' },
  Forearms: { slug: 'forearm', side: 'front' },
  Glutes: { slug: 'gluteal', side: 'back' },
  Quads: { slug: 'quadriceps', side: 'front' },
  Hamstrings: { slug: 'hamstring', side: 'back' },
  Calves: { slug: 'calves', side: 'back' },
}

interface MuscleHighlighterWidgetProps {
  workout: WorkoutSessionWithDetails
  workoutTitle?: string
  backgroundMode?: 'light' | 'dark' | 'transparent'
  gender?: 'male' | 'female'
}

export const MuscleHighlighterWidget = React.forwardRef<
  View,
  MuscleHighlighterWidgetProps
>(({ workout, workoutTitle, backgroundMode = 'light', gender = 'male' }, ref) => {
  const isTransparent = backgroundMode === 'transparent'
  const isDark = backgroundMode === 'dark'

  const colors = getColors(isDark || isTransparent)
  const textColor = isDark || isTransparent ? '#FFFFFF' : '#000'
  const subTextColor = isDark || isTransparent ? 'rgba(255, 255, 255, 0.7)' : '#6B7280'
  const brandColor = isDark || isTransparent ? '#FFFFFF' : '#000'
  const highlightColor = colors.shareableHighlight
  const shadowOpacity = isTransparent ? 0.5 : 0

  const getGradientColors = () => {
    if (isTransparent) return ['transparent', 'transparent'] as const
    const bg = getColors(isDark).shareableCardBg
    return [bg, bg] as const
  }

  // Calculate body parts to highlight
  const frontParts: { slug: string; intensity: number }[] = []
  const backParts: { slug: string; intensity: number }[] = []

  workout.workout_exercises?.forEach((we) => {
    if (!we.exercise?.muscle_group) return
    const mapping = MUSCLE_TO_BODY_PARTS[we.exercise.muscle_group]
    if (!mapping) return

    const part = { slug: mapping.slug, intensity: 1 }
    if (mapping.side === 'front') {
      if (!frontParts.some((p) => p.slug === part.slug)) frontParts.push(part)
    } else {
      if (!backParts.some((p) => p.slug === part.slug)) backParts.push(part)
    }
  })

  return (
    <View ref={ref} style={styles.container} collapsable={false}>
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.contentRow}>
          {/* Left Side: Title and Exercises */}
          <View style={styles.leftColumn}>
            <Text style={[styles.title, { color: textColor, shadowOpacity }]} numberOfLines={2}>
              {workoutTitle || 'Workout'}
            </Text>

            <View style={styles.exerciseSection}>
              {workout.workout_exercises?.slice(0, 8).map((exercise, index) => {
                const sets = exercise.sets || []
                const exerciseName = exercise.exercise?.name || 'Exercise'
                const setCount = sets.length

                return (
                  <View key={index} style={styles.exerciseRow}>
                    <Text style={[styles.setCount, { color: highlightColor, shadowOpacity }]}>
                      {setCount}x
                    </Text>
                    <Text style={[styles.exerciseName, { color: textColor, shadowOpacity }]} numberOfLines={1}>
                      {exerciseName}
                    </Text>
                  </View>
                )
              })}
              {workout.workout_exercises && workout.workout_exercises.length > 8 && (
                <Text style={[styles.moreExercises, { color: subTextColor, shadowOpacity }]}>
                  +{workout.workout_exercises.length - 8} more exercises
                </Text>
              )}
            </View>
          </View>

          {/* Right Side: Body Highlighters */}
          <View style={styles.rightColumn}>
            <View style={styles.bodyWrapper}>
              <Body
                data={frontParts as any}
                side="front"
                scale={0.45}
                gender={gender}
                colors={[highlightColor, highlightColor]}
              />
            </View>
            <View style={styles.bodyWrapper}>
              <Body
                data={backParts as any}
                side="back"
                scale={0.45}
                gender={gender}
                colors={[highlightColor, highlightColor]}
              />
            </View>
          </View>
        </View>

        {/* Bottom Section: Branding */}
        <View style={styles.bottomSection}>
          <View style={styles.brandContainer}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/bicep-icon.png')}
                style={[styles.brandIcon, { tintColor: brandColor, shadowOpacity }]}
                resizeMode="contain"
              />
              <Text style={[styles.brandText, { color: brandColor, shadowOpacity }]}>REP AI</Text>
            </View>
            {(workout.profile?.user_tag || workout.profile?.display_name) && (
              <Text style={[styles.userTagText, { color: textColor, shadowOpacity }]}>
                @{workout.profile?.user_tag || workout.profile?.display_name}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  )
})

MuscleHighlighterWidget.displayName = 'MuscleHighlighterWidget'

const styles = StyleSheet.create({
  container: {
    width: 360,
    height: 420,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  leftColumn: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  exerciseSection: {
    flex: 1,
    gap: 12,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setCount: {
    fontSize: 14,
    fontWeight: '600',
    width: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  exerciseName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  moreExercises: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  rightColumn: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  bodyWrapper: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    paddingTop: 16,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIcon: {
    width: 24,
    height: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  userTagText: {
    fontSize: 16,
    fontWeight: '400',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
})