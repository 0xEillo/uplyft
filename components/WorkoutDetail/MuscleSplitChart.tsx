import { getColors } from '@/constants/colors'
import { useTheme } from '@/contexts/theme-context'
import { calculateMuscleSplitGrouped } from '@/lib/utils/muscle-split'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

interface MuscleSplitChartProps {
  workout: WorkoutSessionWithDetails
}

export function MuscleSplitChart({ workout }: MuscleSplitChartProps) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)

  const muscleSplit = calculateMuscleSplitGrouped(workout)

  if (muscleSplit.length === 0) {
    return null
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        Muscle Split
      </Text>

      <View style={styles.chartContainer}>
        {muscleSplit.map((item, index) => {
          const percentage = Math.round(item.percentage)

          return (
            <View key={index} style={styles.barRow}>
              <View style={styles.labelContainer}>
                <Text style={[styles.muscleLabel, { color: colors.textPrimary }]}>
                  {item.muscleGroup}
                </Text>
              </View>

              <View
                style={[
                  styles.barContainer,
                  {
                    backgroundColor: isDark
                      ? colors.surfaceCard
                      : colors.surfaceSubtle,
                  },
                ]}
              >
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${percentage}%`,
                      backgroundColor: colors.brandPrimary,
                    },
                  ]}
                />
              </View>

              <Text
                style={[
                  styles.percentageLabel,
                  { color: colors.textSecondary },
                ]}
              >
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
    fontSize: 15,
    fontWeight: '600',
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
