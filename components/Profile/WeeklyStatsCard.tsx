import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface WeeklyStatsCardProps {
  streak: number
  workouts: number
  volume: number
  weightUnit: 'kg' | 'lb'
  activity: boolean[]
  onPress: () => void
}

export const WeeklyStatsCard = ({
  streak,
  workouts,
  volume,
  weightUnit,
  activity,
  onPress,
}: WeeklyStatsCardProps) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // Calculate volume display
  const volumeDisplay = (
    weightUnit === 'lb' ? (volume * 2.20462) / 1000 : volume / 1000
  ).toFixed(1)

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.9}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          {/* Streak Chip */}
          <View style={[styles.statChip, styles.streakChip]}>
            <View style={styles.iconCircleStreak}>
              <Ionicons name="flame" size={14} color={colors.white} />
            </View>
            <View>
              <Text style={styles.statLabelSmall}>Streak</Text>
              <Text style={styles.statValue}>
                {streak} <Text style={styles.statUnit}>weeks</Text>
              </Text>
            </View>
          </View>

          {/* Workouts Chip */}
          <View style={[styles.statChip, styles.workoutChip]}>
            <View style={styles.iconCircleWorkout}>
              <Ionicons name="barbell" size={14} color={colors.white} />
            </View>
            <View>
              <Text style={styles.statLabelSmall}>Volume</Text>
              <Text style={styles.statValue}>
                {volumeDisplay}
                <Text style={styles.statUnit}>k</Text>
              </Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />
          
          <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
        </View>

        {/* Calendar Row */}
        <View style={styles.calendarRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
            const isToday = new Date().getDay() === index
            const isActive = activity[index]
            
            const dateNum = (() => {
              const d = new Date()
              const currentDay = d.getDay()
              const diff = index - currentDay
              d.setDate(d.getDate() + diff)
              return d.getDate()
            })()

            return (
              <View key={index} style={styles.dayColumn}>
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                  {day}
                </Text>
                <View style={styles.dayIndicatorContainer}>
                  {isActive ? (
                    <View style={styles.activeDot}>
                      <Text style={styles.activeDateText}>{dateNum}</Text>
                    </View>
                  ) : isToday ? (
                    <View style={styles.todayRing}>
                      <Text style={styles.todayDateText}>{dateNum}</Text>
                    </View>
                  ) : (
                    <Text style={styles.dateText}>{dateNum}</Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </TouchableOpacity>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    card: {
      backgroundColor: colors.feedCardBackground,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
      gap: 12,
    },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
      gap: 10,
    },
    streakChip: {
      backgroundColor: colors.backgroundLight,
    },
    workoutChip: {
      backgroundColor: colors.backgroundLight,
    },
    iconCircleStreak: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircleWorkout: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.textSecondary, // Neutral for volume/workouts
      alignItems: 'center',
      justifyContent: 'center',
    },
    statLabelSmall: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 0,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    statUnit: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    calendarRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
    },
    dayColumn: {
      alignItems: 'center',
      gap: 12,
    },
    dayLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textTertiary,
    },
    dayLabelToday: {
      color: colors.primary,
      fontWeight: '600',
    },
    dayIndicatorContainer: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${colors.primary}30`, // Increased opacity for better contrast
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeDateText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    todayRing: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    todayDateText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    dateText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
  })
