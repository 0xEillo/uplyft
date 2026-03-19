import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { calculateMaintenanceCalories } from '@/lib/nutrition'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
      { id: 'cut', label: 'Cut', calories: Math.round(maintenanceCalories * 0.85), color: '#f97316', icon: 'trending-down-outline' },
      { id: 'maintain', label: 'Maintain', calories: maintenanceCalories, color: '#3b82f6', icon: 'remove-outline' },
      { id: 'bulk', label: 'Bulk', calories: Math.round(maintenanceCalories * 1.1), color: '#10b981', icon: 'trending-up-outline' },
    ]
  }, [maintenanceCalories])

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
      <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <View style={styles.labelSection}>
              <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>Daily Calorie Goal</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={calorieInput}
                  onChangeText={setCalorieInput}
                  onBlur={handleBlur}
                  keyboardType="numeric"
                  returnKeyType="done"
                  placeholder={effectiveGoal.toString()}
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>kcal</Text>
                {isUpdating && <ActivityIndicator size="small" color={colors.brandPrimary} style={styles.loader} />}
              </View>
            </View>
          </View>
          
          <View style={styles.recommendationsRow}>
             {recommendations ? recommendations.map((rec) => {
               const isSelected = Math.abs(effectiveGoal - rec.calories) < 5
               return (
                 <TouchableOpacity
                   key={rec.id}
                   style={[
                     styles.recPill,
                     { backgroundColor: colors.surfaceSubtle },
                     isSelected && { backgroundColor: rec.color + '15', borderColor: rec.color }
                   ]}
                   onPress={() => {
                      setCalorieInput(rec.calories.toString())
                      handleUpdate(rec.calories)
                   }}
                   activeOpacity={0.7}
                 >
                   <Text style={[styles.recLabel, { color: isSelected ? rec.color : colors.textSecondary }]}>{rec.label}</Text>
                   <Text style={[styles.recValue, { color: colors.textPrimary }]}>{rec.calories}</Text>
                 </TouchableOpacity>
               )
             }) : (
               <Text style={[styles.missingText, { color: colors.textTertiary }]}>
                 Complete profile for personalized goals
               </Text>
             )}
          </View>
        </View>
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
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  labelSection: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  input: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    padding: 0,
    minWidth: 70,
  },
  unit: {
    fontSize: 15,
    fontWeight: '600',
  },
  loader: {
    marginLeft: 10,
  },
  recommendationsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  recPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  recLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  missingText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    flex: 1,
  }
})
