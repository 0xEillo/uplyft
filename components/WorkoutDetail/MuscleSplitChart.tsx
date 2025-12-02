import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { calculateMuscleSplitGrouped } from '@/lib/utils/muscle-split'
import { useTheme } from '@/contexts/theme-context'
import { getColors } from '@/constants/colors'

interface MuscleSplitChartProps {
  workout: WorkoutSessionWithDetails
}

// Color mapping for muscle groups
const MUSCLE_COLORS: { [key: string]: string } = {
  Chest: '#FF6B6B',
  Back: '#4ECDC4',
  Shoulders: '#FFE66D',
  Arms: '#95E1D3',
  Legs: '#A8E6CF',
  Core: '#C7CEEA',
  Glutes: '#FFDAB9',
  'Full Body': '#B8B8B8',
}

export function MuscleSplitChart({ workout }: MuscleSplitChartProps) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)

  const muscleSplit = calculateMuscleSplitGrouped(workout)

  if (muscleSplit.length === 0) {
    return null
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.feedCardBackground, borderBottomColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        Muscle Split
      </Text>

      <View style={styles.chartContainer}>
        {muscleSplit.map((item, index) => {
          const barColor = MUSCLE_COLORS[item.muscleGroup] || colors.primary
          const percentage = Math.round(item.percentage)

          return (
            <View key={index} style={styles.barRow}>
              <View style={styles.labelContainer}>
                <Text style={[styles.muscleLabel, { color: colors.text }]}>
                  {item.muscleGroup}
                </Text>
              </View>

              <View style={[styles.barContainer, { backgroundColor: colors.backgroundLight }]}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${percentage}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>

              <Text style={[styles.percentageLabel, { color: colors.textSecondary }]}>
                {percentage}%
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
  },
  chartContainer: {
    gap: 12,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelContainer: {
    width: 80,
  },
  muscleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  barContainer: {
    flex: 1,
    height: 24,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  percentageLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
})
