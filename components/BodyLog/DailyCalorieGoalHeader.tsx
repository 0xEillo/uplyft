import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { calculateMaintenanceCalories } from '@/lib/nutrition'
import { database } from '@/lib/database'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

interface DailyCalorieGoalHeaderProps {
  userId: string
  currentGoal?: number | null
  onUpdate: (goal: number) => void
}

export function DailyCalorieGoalHeader({ userId, currentGoal, onUpdate }: DailyCalorieGoalHeaderProps) {
  const { profile } = useProfile()
  const colors = useThemedColors()
  const [calorieInput, setCalorieInput] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [segmentWidth, setSegmentWidth] = useState(0)
  const slideAnim = useRef(new Animated.Value(0)).current

  const maintenanceCalories = useMemo(
    () => calculateMaintenanceCalories(profile ?? null),
    [profile],
  )

  const effectiveGoal = useMemo(() => {
    return currentGoal ?? maintenanceCalories ?? 2000
  }, [currentGoal, maintenanceCalories])

  useEffect(() => {
    if (effectiveGoal) {
      setCalorieInput(effectiveGoal.toString())
    }
  }, [effectiveGoal])

  const recommendations = useMemo(() => {
    if (!maintenanceCalories) return null
    return [
      { id: 'cut', label: 'Cut', calories: Math.round(maintenanceCalories * 0.85) },
      { id: 'maintain', label: 'Maintain', calories: maintenanceCalories },
      { id: 'bulk', label: 'Bulk', calories: Math.round(maintenanceCalories * 1.1) },
    ]
  }, [maintenanceCalories])

  // Determine active segment index
  const activeIndex = useMemo(() => {
    if (!recommendations) return 1
    const idx = recommendations.findIndex(r => Math.abs(effectiveGoal - r.calories) < 5)
    return idx >= 0 ? idx : 1
  }, [effectiveGoal, recommendations])

  // Animate the slider when the active index changes
  useEffect(() => {
    if (segmentWidth > 0) {
      Animated.spring(slideAnim, {
        toValue: activeIndex * segmentWidth,
        useNativeDriver: true,
        tension: 300,
        friction: 30,
      }).start()
    }
  }, [activeIndex, segmentWidth, slideAnim])

  const handleSegmentLayout = (e: LayoutChangeEvent) => {
    const totalWidth = e.nativeEvent.layout.width
    setSegmentWidth(totalWidth / 3)
  }

  const handleUpdate = async (goal: number) => {
    if (goal === effectiveGoal && calorieInput === goal.toString()) return
    try {
      setIsUpdating(true)
      await database.dailyLog.updateDay(userId, { calorieGoal: goal })
      onUpdate(goal)
      haptic('medium')
    } catch (error) {
      console.error('Failed to update calorie goal:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleBlur = () => {
    const goal = parseInt(calorieInput.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(goal)) {
      handleUpdate(goal)
    } else {
      setCalorieInput(effectiveGoal.toString())
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.surfaceCard }]}>
        {/* Header section */}
        <View style={styles.headerSection}>
          <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>Daily Calorie Goal</Text>
          <View style={styles.goalRow}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.goalNumber, { color: colors.textPrimary }]}
                value={calorieInput}
                onChangeText={setCalorieInput}
                onBlur={handleBlur}
                keyboardType="numeric"
                returnKeyType="done"
                placeholder={effectiveGoal.toString()}
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={[styles.unitLabel, { color: colors.textTertiary }]}>kcal</Text>
              {isUpdating && <ActivityIndicator size="small" color={colors.textSecondary} style={styles.loader} />}
            </View>
          </View>
        </View>

        {/* Segmented Control */}
        {recommendations ? (
          <View style={styles.segmentWrapper}>
            <View
              style={[styles.segmentTrack, { backgroundColor: colors.surfaceSubtle }]}
              onLayout={handleSegmentLayout}
            >
              {/* Animated sliding pill */}
              {segmentWidth > 0 && (
                <Animated.View
                  style={[
                    styles.segmentPill,
                    {
                      width: segmentWidth - 4,
                      backgroundColor: colors.surfaceCard,
                      transform: [{ translateX: Animated.add(slideAnim, 2) }],
                    }
                  ]}
                />
              )}

              {/* Segment buttons */}
              {recommendations.map((rec, index) => {
                const isActive = index === activeIndex
                return (
                  <TouchableOpacity
                    key={rec.id}
                    style={styles.segmentButton}
                    onPress={() => {
                      setCalorieInput(rec.calories.toString())
                      handleUpdate(rec.calories)
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.segmentLabel,
                      { color: isActive ? colors.textPrimary : colors.textTertiary },
                      isActive && styles.segmentLabelActive,
                    ]}>
                      {rec.label}
                    </Text>
                    <Text style={[
                      styles.segmentValue,
                      { color: isActive ? colors.textPrimary : colors.textTertiary },
                      isActive && styles.segmentValueActive,
                    ]}>
                      {rec.calories.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ) : (
          <View style={styles.missingWrapper}>
            <Text style={[styles.missingText, { color: colors.textTertiary }]}>
              Complete profile for personalized goals
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 14,
    paddingHorizontal: 20,
    gap: 18,
  },
  headerSection: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  goalNumber: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
    padding: 0,
    minWidth: 80,
  },
  unitLabel: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 2,
  },
  loader: {
    marginLeft: 8,
  },

  // Segmented control — Apple-style
  segmentWrapper: {
    // empty - spacing handled by card gap
  },
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
    position: 'relative',
  },
  segmentPill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 8,
    // Shadow for the sliding pill
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    zIndex: 1,
    gap: 1,
  },
  segmentLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  segmentLabelActive: {
    fontWeight: '600',
  },
  segmentValue: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  segmentValueActive: {
    fontWeight: '700',
  },

  missingWrapper: {
    paddingVertical: 8,
  },
  missingText: {
    fontSize: 13,
    textAlign: 'center',
  },
})
