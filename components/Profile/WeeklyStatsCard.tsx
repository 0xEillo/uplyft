import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface WeeklyStatsCardProps {
  streak: number
  workouts: number
  volume: number
  weightUnit: 'kg' | 'lb'
  activity: boolean[]
  onPress: () => void
  showChevron?: boolean
}

export const WeeklyStatsCard = ({
  streak,
  workouts,
  volume,
  weightUnit,
  activity,
  onPress,
  showChevron = true,
}: WeeklyStatsCardProps) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [showStreakLabel, setShowStreakLabel] = useState(false)
  const [showVolumeLabel, setShowVolumeLabel] = useState(false)

  const handleStreakTap = useCallback(() => {
    setShowStreakLabel(true)
    setTimeout(() => setShowStreakLabel(false), 1000)
  }, [])

  const handleVolumeTap = useCallback(() => {
    setShowVolumeLabel(true)
    setTimeout(() => setShowVolumeLabel(false), 1000)
  }, [])

  // Calculate volume display
  const volumeDisplay = (weightUnit === 'lb'
    ? (volume * 2.20462) / 1000
    : volume / 1000
  ).toFixed(1)

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.card}
        onPress={showChevron ? onPress : undefined}
        activeOpacity={showChevron ? 0.9 : 1}
        disabled={!showChevron}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={handleStreakTap}
            activeOpacity={0.7}
          >
            {showStreakLabel && <Text style={styles.statLabel}>Streak</Text>}
            <Ionicons name="flame" size={16} color={colors.primary} />
            <Text style={styles.statValue}>
              {streak} <Text style={styles.statUnit}>weeks</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.statDivider} />

          <TouchableOpacity
            style={styles.statItem}
            onPress={handleVolumeTap}
            activeOpacity={0.7}
          >
            {showVolumeLabel && <Text style={styles.statLabel}>Volume</Text>}
            <Ionicons name="barbell" size={16} color={colors.primary} />
            <Text style={styles.statValue}>
              {volumeDisplay}
              <Text style={styles.statUnit}>k</Text>
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          {showChevron && (
            <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
          )}
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
                <Text
                  style={[styles.dayLabel, isToday && styles.dayLabelToday]}
                >
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
      paddingHorizontal: 14,
      marginBottom: 16,
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
      gap: 6,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      marginRight: 2,
    },
    statDivider: {
      width: 1,
      height: 14,
      backgroundColor: colors.border,
      marginHorizontal: 10,
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
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeDateText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.white,
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
