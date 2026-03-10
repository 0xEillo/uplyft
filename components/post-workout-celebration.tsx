import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { PostWorkoutCelebrationData } from '@/contexts/success-overlay-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { useWorkoutShare } from '@/hooks/useWorkoutShare'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { WorkoutSummaryWidget } from './shareable-widgets/WorkoutSummaryWidget'
import { StatsMetricsWidget } from './shareable-widgets/StatsMetricsWidget'
import { StravaOverlayWidget } from './shareable-widgets/StravaOverlayWidget'
import { AchievementWidget } from './shareable-widgets/AchievementWidget'
import { StreakWidget } from './shareable-widgets/StreakWidget'
import { PointsWidget } from './shareable-widgets/PointsWidget'
import { ExerciseUpgradeWidget } from './shareable-widgets/ExerciseUpgradeWidget'
import { PrDetail, PrService } from '@/lib/pr'
import { mapSetsToPrContext, resolvePrContextUserId } from '@/lib/utils/pr-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface PostWorkoutCelebrationProps {
  visible: boolean
  data: PostWorkoutCelebrationData | null
  onClose: () => void
}

type WidgetData =
  | { type: 'streak'; currentStreak: number }
  | {
      type: 'exercise_upgrade'
      exerciseName: string
      previousLevel: string
      currentLevel: string
    }
  | {
      type: 'points'
      previousScore: number
      currentScore: number
      pointsGained: number
      previousLevel: string
      currentLevel: string
      nextLevel: string | null
      progress: number
    }
  | { type: 'summary' }
  | { type: 'stats' }
  | { type: 'strava' }
  | { type: 'achievement'; prData: { exerciseId: string; exerciseName: string; prs: PrDetail[] }[] }

export function PostWorkoutCelebration({
  visible,
  data,
  onClose,
}: PostWorkoutCelebrationProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { user } = useAuth()
  const { weightUnit } = useWeightUnits()
  const { saveWidgetToPhotosAndClipboard } = useWorkoutShare()

  const [allWidgets, setAllWidgets] = useState<WidgetData[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const [backgroundMode, setBackgroundMode] = useState<'light' | 'dark' | 'transparent'>(isDark ? 'dark' : 'light')
  const [workoutCountThisWeek, setWorkoutCountThisWeek] = useState<number>(data?.workoutCountThisWeek || 1)
  
  const scrollViewRef = useRef<ScrollView>(null)
  const widgetRefs = useRef<Map<number, View>>(new Map())

  const getWidgetRef = (index: number) => (el: View | null) => {
    if (el) {
      widgetRefs.current.set(index, el)
    } else {
      widgetRefs.current.delete(index)
    }
  }

  // Sync background mode with theme when modal opens
  useEffect(() => {
    if (visible) {
      setBackgroundMode(isDark ? 'dark' : 'light')
    }
  }, [visible, isDark])

  useEffect(() => {
    if (visible && data?.workout && data.workoutCountThisWeek === undefined && user?.id) {
      const fetchCount = async () => {
        try {
          const { database } = await import('@/lib/database')
          const count = await database.workoutSessions.getWeeklyWorkoutCount(
            user.id,
            new Date(data.workout.date),
            data.workout.id,
          )
          setWorkoutCountThisWeek(count)
        } catch (error) {
          console.error('Error fetching workout count:', error)
        }
      }
      fetchCount()
    } else if (data?.workoutCountThisWeek !== undefined) {
      setWorkoutCountThisWeek(data.workoutCountThisWeek)
    }
  }, [visible, data?.workout, data?.workoutCountThisWeek, user?.id])

  useEffect(() => {
    if (!visible || !data) {
      setAllWidgets([])
      setShowGrid(false)
      setCurrentPage(0)
      return
    }

    const buildWidgets = async () => {
      const widgets: WidgetData[] = []

      // 1. Streak
      if (data.streakData && data.streakData.currentStreak > 0 && data.streakData.isMilestone) {
        widgets.push({ type: 'streak', currentStreak: data.streakData.currentStreak })
      }

      // 2. Points
      if (data.pointsData && data.pointsData.pointsGained > 0) {
        widgets.push({ type: 'points', ...data.pointsData })
      }

      // 3. Exercise Upgrades
      if (data.exerciseUpgrades && data.exerciseUpgrades.length > 0) {
        data.exerciseUpgrades.forEach((upgrade) => {
          widgets.push({
            type: 'exercise_upgrade',
            exerciseName: upgrade.exerciseName,
            previousLevel: upgrade.previousLevel,
            currentLevel: upgrade.currentLevel,
          })
        })
      }

      // 4. Summary & Stats & Strava
      widgets.push({ type: 'summary' })
      widgets.push({ type: 'stats' })
      widgets.push({ type: 'strava' })

      // 5. Achievement (PRs)
      try {
        const prUserId = resolvePrContextUserId(data.workout.user_id, user?.id)
        if (prUserId && data.workout.created_at && data.workout.date) {
          const ctx = {
            sessionId: data.workout.id,
            userId: prUserId,
            createdAt: data.workout.created_at,
            date: data.workout.date,
            exercises: (data.workout.workout_exercises || []).map((we) => ({
              exerciseId: we.exercise_id,
              exerciseName: we.exercise?.name || 'Exercise',
              sets: mapSetsToPrContext(we.sets),
            })),
          }
          const result = await PrService.computePrsForSession(ctx)
          const exercisesWithPRs = result.perExercise.filter((ex) =>
            ex.prs.some((pr) => pr.isCurrent),
          )
          if (exercisesWithPRs.length > 0) {
            widgets.push({ type: 'achievement', prData: exercisesWithPRs })
          }
        }
      } catch (error) {
        console.error('Error computing PRs:', error)
      }

      setAllWidgets(widgets)
    }

    buildWidgets()
  }, [visible, data, user?.id])

  const styles = createStyles(colors, isDark)

  const handleScroll = (event: {
    nativeEvent: { contentOffset: { x: number } }
  }) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const page = Math.round(offsetX / SCREEN_WIDTH)
    if (page !== currentPage) {
      setCurrentPage(page)
    }
  }

  const handleShare = async (index: number) => {
    const ref = widgetRefs.current.get(index)
    if (!ref) return
    try {
      await saveWidgetToPhotosAndClipboard(ref)
    } catch (error) {
      console.error('Error saving widget:', error)
    }
  }

  const renderWidget = (widget: WidgetData, index: number, isGrid: boolean) => {
    const ref = getWidgetRef(index)
    
    const content = (() => {
      switch (widget.type) {
        case 'streak':
          return <StreakWidget ref={ref} currentStreak={widget.currentStreak} username={user?.user_metadata?.user_tag || user?.user_metadata?.display_name} backgroundMode={backgroundMode} />
        case 'points':
          return <PointsWidget ref={ref} {...widget} username={user?.user_metadata?.user_tag || user?.user_metadata?.display_name} backgroundMode={backgroundMode} />
        case 'exercise_upgrade':
          return <ExerciseUpgradeWidget ref={ref} {...widget} username={user?.user_metadata?.user_tag || user?.user_metadata?.display_name} backgroundMode={backgroundMode} />
        case 'summary':
          return <WorkoutSummaryWidget ref={ref} workout={data!.workout} weightUnit={weightUnit} workoutTitle={data!.workoutTitle} backgroundMode={backgroundMode} />
        case 'stats':
          return <StatsMetricsWidget ref={ref} workout={data!.workout} weightUnit={weightUnit} workoutCountThisWeek={workoutCountThisWeek} backgroundMode={backgroundMode} />
        case 'strava':
          return (
            <View>
              {backgroundMode === 'transparent' && (
                <View style={[StyleSheet.absoluteFill, styles.checkerboardContainer]}>
                  <View style={styles.checkerboardRow}>
                    {Array.from({ length: 420 }).map((_, i) => {
                      const squaresPerRow = Math.floor(360 / 20);
                      const row = Math.floor(i / squaresPerRow);
                      const col = i % squaresPerRow;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.checkerboardSquare,
                            { backgroundColor: (row + col) % 2 === 0 ? '#3A3A3C' : '#2C2C2E' },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              )}
              <StravaOverlayWidget ref={ref} workout={data!.workout} weightUnit={weightUnit} backgroundMode={backgroundMode} />
            </View>
          )
        case 'achievement':
          return <AchievementWidget ref={ref} workout={data!.workout} weightUnit={weightUnit} prData={widget.prData} backgroundMode={backgroundMode} />
      }
    })()

    if (isGrid) {
      return (
        <TouchableOpacity 
          key={index}
          style={[styles.gridWidgetWrapper, { backgroundColor: colors.surfaceCard }]}
          activeOpacity={0.8}
          onPress={() => handleShare(index)}
        >
          <View style={styles.gridWidgetScale}>
            {content}
          </View>
        </TouchableOpacity>
      )
    }

    return (
      <View key={index} style={styles.slide}>
        <View style={styles.carouselWidgetWrapper}>
          {content}
        </View>
      </View>
    )
  }

  const carouselWidgets = allWidgets.slice(0, 4)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={showGrid ? () => setShowGrid(false) : onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.bg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={showGrid ? () => setShowGrid(false) : onClose} style={styles.closeButton}>
              <Ionicons name={showGrid ? "chevron-back" : "close"} size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.colorToggle}
                onPress={() => {
                  const modes: ('light' | 'dark' | 'transparent')[] = ['light', 'dark', 'transparent']
                  setBackgroundMode(modes[(modes.indexOf(backgroundMode) + 1) % modes.length])
                }}
              >
                {backgroundMode === 'light' && <View style={[styles.bgCircle, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' }]} />}
                {backgroundMode === 'dark' && <View style={[styles.bgCircle, { backgroundColor: '#000' }]} />}
                {backgroundMode === 'transparent' && <View style={[styles.bgCircle, { backgroundColor: '#D1D1D6', borderWidth: 1, borderColor: '#FFF' }]} />}
              </TouchableOpacity>
              
              {!showGrid && (
                <TouchableOpacity
                  onPress={() => setShowGrid(true)}
                  style={styles.plusButton}
                >
                  <Ionicons name="add" size={28} color={colors.textPrimary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Title Section */}
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>
              {showGrid ? 'Tap to save' : 'Great work!'}
            </Text>
            {!showGrid && (
              <Text style={styles.headerSubtitle}>
                Your workout number {data?.workoutNumber || 1}
              </Text>
            )}
          </View>

          {showGrid ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollView}
              contentContainerStyle={styles.gridContainer}
            >
              {allWidgets.map((widget, index) => renderWidget(widget, index, true))}
            </ScrollView>
          ) : (
            <>
              {/* Carousel */}
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={styles.scrollView}
              >
                {carouselWidgets.map((widget, index) => renderWidget(widget, index, false))}
              </ScrollView>

              {/* Footer controls */}
              <View style={styles.footer}>
                <View style={styles.pagination}>
                  {carouselWidgets.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        { backgroundColor: i === currentPage ? '#000' : '#E5E5EA' },
                      ]}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.actionButton}
                  activeOpacity={0.8}
                  onPress={() => handleShare(currentPage)}
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color={isDark ? colors.bg : colors.onPrimary}
                    style={styles.actionIcon}
                  />
                  <Text style={styles.actionButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalContent: {
      flex: 1,
      marginTop: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 10,
    },
    closeButton: {
      padding: 4,
      width: 40,
    },
    titleContainer: {
      alignItems: 'center',
      paddingTop: 24,
      paddingBottom: 24,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: 40,
      gap: 8,
    },
    colorToggle: {
      padding: 4,
    },
    bgCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    plusButton: {
      padding: 4,
    },
    scrollView: {
      flex: 1,
    },
    slide: {
      width: SCREEN_WIDTH,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    carouselWidgetWrapper: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 8,
      borderRadius: 24,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 16,
      padding: 16,
      paddingBottom: 40,
    },
    gridWidgetWrapper: {
      width: 360 * 0.45,
      height: 420 * 0.45,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    gridWidgetScale: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 360,
      height: 420,
      transform: [
        { translateX: -360 * (1 - 0.45) / 2 },
        { translateY: -420 * (1 - 0.45) / 2 },
        { scale: 0.45 },
      ],
    },
    checkerboardContainer: {
      borderRadius: 24,
      overflow: 'hidden',
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: '#FFFFFF',
    },
    checkerboardRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: '100%',
      height: '100%',
    },
    checkerboardSquare: {
      width: 20,
      height: 20,
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
      alignItems: 'center',
    },
    pagination: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    actionButton: {
      backgroundColor: colors.textPrimary,
      width: '100%',
      paddingVertical: 18,
      borderRadius: 30,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionIcon: {
      marginTop: -2,
    },
    actionButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? colors.bg : colors.onPrimary,
    },
  })
