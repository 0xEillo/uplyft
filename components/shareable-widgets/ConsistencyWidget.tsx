import { useThemedColors } from '@/hooks/useThemedColors'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import {
    Image,
    StyleSheet,
    Text,
    View,
} from 'react-native'

interface ConsistencyWidgetProps {
  workoutDates: string[] | Set<string>
  variant: 'month' | 'yearly' | 'multi-year'
  backgroundMode?: 'light' | 'dark' | 'transparent'
  userTag?: string
  displayName?: string
}

export const ConsistencyWidget = React.forwardRef<
  View,
  ConsistencyWidgetProps
>(({ workoutDates, variant, backgroundMode = 'light', userTag, displayName }, ref) => {
  const colors = useThemedColors()
  const datesSet = workoutDates instanceof Set ? workoutDates : new Set(workoutDates)

  // Determine colors based on background mode
  const isDark = backgroundMode === 'dark'
  const isTransparent = backgroundMode === 'transparent'
  
  const textColor = isDark || isTransparent ? '#FFFFFF' : '#1C1C1E'
  const subTextColor = isDark || isTransparent ? 'rgba(255, 255, 255, 0.8)' : '#8E8E93'
  const brandColor = '#FF6B35'
  const dividerColor = isDark || isTransparent ? 'rgba(255, 255, 255, 0.3)' : '#E5E5EA'
  const shadowOpacity = isTransparent ? 0.5 : 0

  const getGradientColors = () => {
    if (isTransparent) return ['transparent', 'transparent'] as const
    if (isDark) return ['#1C1C1E', '#000000'] as const
    return ['#FFFFFF', '#F2F2F7'] as const
  }

  const renderMonthView = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()

    const firstDay = new Date(year, month, 1)
    const startingDayOfWeek = firstDay.getDay()
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    const days = []
    const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

    for (let i = 0; i < startingDayOfWeek; i++) days.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ day, hasWorkout: datesSet.has(dateStr) })
    }

    const monthWorkoutCount = days.filter(d => d && d.hasWorkout).length

    return (
        <View style={styles.variantContainer}>
            <View style={styles.variantHeader}>
                <Text style={[styles.variantTitle, { color: textColor }]}>{monthName.split(' ')[0]}</Text>
                <Text style={[styles.variantSubTitle, { color: subTextColor }]}>
                    {monthWorkoutCount} Sessions
                </Text>
            </View>
            <View style={styles.monthNamesRow}>
              {dayNames.map((name, i) => (
                <Text key={i} style={[styles.monthDayName, { color: subTextColor }]}>{name}</Text>
              ))}
            </View>
            <View style={styles.monthGrid}>
                {days.map((dayData, index) => (
                  <View key={index} style={styles.monthDayCell}>
                    {dayData && (
                      <View 
                        style={[
                          styles.monthDayBox,
                          { backgroundColor: isDark || isTransparent ? 'rgba(255,255,255,0.1)' : '#E5E5EA' },
                          dayData.hasWorkout && { backgroundColor: brandColor }
                        ]}
                      >
                         <Text style={[
                           styles.monthDayText, 
                           { color: dayData.hasWorkout ? '#FFF' : textColor }
                         ]}>
                           {dayData.day}
                         </Text>
                      </View>
                    )}
                  </View>
                ))}
            </View>
        </View>
    )
  }

  const renderYearlyView = () => {
    const year = new Date().getFullYear()
    const months = []
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    for (let month = 0; month < 12; month++) {
      // Generate mini calendar for this month
      const firstDay = new Date(year, month, 1)
      const startingDayOfWeek = firstDay.getDay()
      const lastDay = new Date(year, month + 1, 0)
      const daysInMonth = lastDay.getDate()

      const days = []
      for (let i = 0; i < startingDayOfWeek; i++) days.push(null)
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        days.push({ hasWorkout: datesSet.has(dateStr) })
      }

      months.push(
        <View key={month} style={styles.miniMonth}>
          <Text style={[styles.miniMonthName, { color: subTextColor }]}>{monthNames[month]}</Text>
          <View style={styles.miniGrid}>
            {days.map((dayData, index) => (
              <View key={index} style={styles.miniDay}>
                {dayData && (
                  <View
                    style={[
                      styles.miniDayBox,
                      { backgroundColor: isDark || isTransparent ? 'rgba(255,255,255,0.1)' : '#E5E5EA' },
                      dayData.hasWorkout && { backgroundColor: brandColor },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
      )
    }

    const yearWorkoutCount = [...datesSet].filter(d => d.startsWith(String(year))).length

    return (
      <View style={styles.variantContainer}>
        <View style={styles.variantHeader}>
            <Text style={[styles.variantTitle, { color: textColor }]}>{year}</Text>
            <Text style={[styles.variantSubTitle, { color: subTextColor }]}>
                {yearWorkoutCount} Sessions
            </Text>
        </View>
        <View style={styles.yearGrid}>{months}</View>
      </View>
    )
  }

  const renderMultiYearView = () => {
    const currentYear = new Date().getFullYear()
    const years = [currentYear, currentYear - 1].filter(y => {
        // Only show previous year if there are workouts or if we want to show 2 years
        return true 
    })

    const renderYearGraph = (year: number) => {
        const firstDayOfYear = new Date(year, 0, 1)
        const lastDayOfYear = new Date(year, 11, 31)
        const totalDays = Math.ceil((lastDayOfYear.getTime() - firstDayOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const weeks: (Date | null)[][] = []
        const firstDayOfWeek = firstDayOfYear.getDay()
        let currentWeek: (Date | null)[] = []

        for (let i = 0; i < firstDayOfWeek; i++) currentWeek.push(null)
        for (let i = 0; i < totalDays; i++) {
            currentWeek.push(new Date(year, 0, 1 + i))
            if (currentWeek.length === 7) {
                weeks.push(currentWeek)
                currentWeek = []
            }
        }
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) currentWeek.push(null)
            weeks.push(currentWeek)
        }

        const cellGap = 2
        const availableWidth = 312 // Container width minus padding
        const numWeeks = weeks.length
        const cellSize = (availableWidth - (numWeeks - 1) * cellGap) / numWeeks

        return (
            <View key={year} style={styles.multiYearYearGroup}>
                <Text style={[styles.multiYearYearTitle, { color: subTextColor }]}>{year}</Text>
                <View style={[styles.multiYearWeeksContainer, { gap: cellGap }]}>
                    {weeks.map((week, weekIdx) => (
                        <View key={weekIdx} style={[styles.multiYearWeek, { gap: cellGap }]}>
                            {week.map((date, dayIdx) => {
                                if (!date) return <View key={dayIdx} style={[styles.multiYearDay, { width: cellSize, height: cellSize, backgroundColor: 'transparent' }]} />
                                const dateStr = date.toISOString().split('T')[0]
                                const hasWorkout = datesSet.has(dateStr)
                                return (
                                    <View
                                        key={dayIdx}
                                        style={[
                                            styles.multiYearDay,
                                            { 
                                                width: cellSize, 
                                                height: cellSize, 
                                                borderRadius: 1,
                                                backgroundColor: isDark || isTransparent ? 'rgba(255,255,255,0.1)' : '#E5E5EA' 
                                            },
                                            hasWorkout && { backgroundColor: brandColor }
                                        ]}
                                    />
                                )
                            })}
                        </View>
                    ))}
                </View>
            </View>
        )
    }

    const totalSessionCount = datesSet.size

    return (
        <View style={styles.variantContainer}>
             <View style={styles.variantHeader}>
                <Text style={[styles.variantTitle, { color: textColor }]}>{years[years.length - 1]}—{years[0]}</Text>
                <Text style={[styles.variantSubTitle, { color: subTextColor }]}>
                    {totalSessionCount} Sessions
                </Text>
            </View>
            {years.map(renderYearGraph)}
        </View>
    )
  }

  return (
    <View ref={ref} style={styles.container} collapsable={false}>
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Main Content */}
        <View style={styles.content}>
            {variant === 'month' && renderMonthView()}
            {variant === 'yearly' && renderYearlyView()}
            {variant === 'multi-year' && renderMultiYearView()}
        </View>

        {/* Bottom Section: Branding */}
        <View style={styles.bottomSection}>
          <View style={styles.brandContainer}>
            <View style={[styles.brandLine, { backgroundColor: dividerColor }]} />
            <View style={styles.brandContent}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/bicep-icon.png')}
                  style={[styles.brandIcon, { tintColor: brandColor }]}
                  resizeMode="contain"
                />
                <Text style={[styles.brandText, { color: brandColor }]}>REP AI</Text>
              </View>
              {(userTag || displayName) && (
                <Text style={[styles.userTagText, { color: subTextColor }]}>
                  @{userTag || displayName}
                </Text>
              )}
            </View>
            <View style={[styles.brandLine, { backgroundColor: dividerColor }]} />
          </View>
        </View>
      </LinearGradient>
    </View>
  )
})

ConsistencyWidget.displayName = 'ConsistencyWidget'

const styles = StyleSheet.create({
  container: {
    width: 360,
    height: 420,
    borderRadius: 0,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  variantContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  variantTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 2,
  },
  variantSubTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 0,
    opacity: 0.8,
  },
  variantHeader: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  // Month styles
  monthNamesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  monthDayName: {
    fontSize: 10,
    fontWeight: '700',
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthDayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 4.5,
  },
  monthDayBox: {
    flex: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Yearly styles
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  miniMonth: {
    width: '23%',
    marginBottom: 8,
  },
  miniMonthName: {
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  miniDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 0.3,
  },
  miniDayBox: {
    width: '100%',
    height: '100%',
    borderRadius: 1,
  },
  // Multi-year styles
  multiYearYearGroup: {
    marginBottom: 20,
  },
  multiYearYearTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  multiYearWeeksContainer: {
    flexDirection: 'row',
  },
  multiYearWeek: {
    flexDirection: 'column',
  },
  multiYearDay: {
    // sizing is dynamic
  },
  // Branding styles
  bottomSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandContent: {
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 2,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  brandIcon: {
    width: 20,
    height: 20,
  },
  brandLine: {
    width: 40,
    height: 2,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  userTagText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
})
