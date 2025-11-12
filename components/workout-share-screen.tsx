import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { PrService } from '@/lib/pr'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { AchievementWidget } from './shareable-widgets/AchievementWidget'
import { StatsMetricsWidget } from './shareable-widgets/StatsMetricsWidget'
import { WorkoutSummaryWidget } from './shareable-widgets/WorkoutSummaryWidget'

const SCREEN_WIDTH = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

interface WorkoutShareScreenProps {
  visible: boolean
  workout: WorkoutSessionWithDetails
  weightUnit: 'kg' | 'lb'
  workoutCountThisWeek: number
  workoutTitle?: string
  onClose: () => void
  onShare: (
    widgetIndex: number,
    shareType: 'instagram' | 'general',
    widgetRef: View,
  ) => void
}

export function WorkoutShareScreen({
  visible,
  workout,
  weightUnit,
  workoutCountThisWeek,
  workoutTitle,
  onClose,
  onShare,
}: WorkoutShareScreenProps) {
  const colors = useThemedColors()
  const { user } = useAuth()
  const scrollViewRef = useRef<ScrollView>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [prData, setPrData] = useState<{ exerciseName: string; prs: any[] }[]>(
    [],
  )
  const [hasPRs, setHasPRs] = useState(false)

  // Compute PRs when workout or visibility changes
  useEffect(() => {
    if (!visible || !user?.id || !workout.workout_exercises?.length) {
      setPrData([])
      setHasPRs(false)
      return
    }

    const computePRs = async () => {
      try {
        const ctx = {
          sessionId: workout.id,
          userId: user.id,
          createdAt: workout.created_at,
          exercises: (workout.workout_exercises || []).map((we) => ({
            exerciseId: we.exercise_id,
            exerciseName: we.exercise?.name || 'Exercise',
            sets: (we.sets || []).map((s) => ({
              reps: s.reps,
              weight: s.weight,
            })),
          })),
        }

        const result = await PrService.computePrsForSession(ctx)
        const exercisesWithPRs = result.perExercise.filter((ex) =>
          ex.prs.some((pr) => pr.isCurrent),
        )

        setPrData(exercisesWithPRs)
        setHasPRs(exercisesWithPRs.length > 0)
      } catch (error) {
        console.error('Error computing PRs:', error)
        setPrData([])
        setHasPRs(false)
      }
    }

    computePRs()
  }, [visible, workout, user?.id])

  // Refs for each widget (for capturing) - needs to be accessible from parent
  const widget1Ref = useRef<View>(null)
  const widget2Ref = useRef<View>(null)
  const widget3Ref = useRef<View>(null)

  // Build widget refs array dynamically based on whether PRs exist
  const widgetRefs = [widget1Ref, widget2Ref, ...(hasPRs ? [widget3Ref] : [])]

  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const backdropAnim = useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    console.log('[WorkoutShareScreen] Visibility changed:', visible)
    if (visible) {
      console.log('[WorkoutShareScreen] Starting slide animation')
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, slideAnim, backdropAnim])

  // Pan responder for swipe-to-dismiss - only intercepts vertical swipes
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only intercept if gesture is primarily vertical (downward)
        return (
          gestureState.dy > 5 && gestureState.dy > Math.abs(gestureState.dx)
        )
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          onClose()
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 25,
            stiffness: 200,
          }).start()
        }
      },
    }),
  ).current

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const page = Math.round(offsetX / SCREEN_WIDTH)
    setCurrentPage(page)
  }

  const handleShareInstagram = () => {
    const currentRef = widgetRefs[currentPage]
    if (currentRef?.current) {
      onShare(currentPage, 'instagram', currentRef.current)
    }
  }

  const handleShareGeneral = () => {
    const currentRef = widgetRefs[currentPage]
    if (currentRef?.current) {
      onShare(currentPage, 'general', currentRef.current)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
          </View>

          {/* Swipeable widgets */}
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH}
            snapToAlignment="center"
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
          >
            {/* Widget 1: Summary */}
            <View style={styles.widgetPage}>
              <WorkoutSummaryWidget
                ref={widget1Ref}
                workout={workout}
                weightUnit={weightUnit}
                workoutTitle={workoutTitle}
              />
            </View>

            {/* Widget 2: Stats */}
            <View style={styles.widgetPage}>
              <StatsMetricsWidget
                ref={widget2Ref}
                workout={workout}
                weightUnit={weightUnit}
                workoutCountThisWeek={workoutCountThisWeek}
              />
            </View>

            {/* Widget 3: Achievement - only show if PRs exist */}
            {hasPRs && (
              <View style={styles.widgetPage}>
                <AchievementWidget
                  ref={widget3Ref}
                  workout={workout}
                  weightUnit={weightUnit}
                  prData={prData}
                />
              </View>
            )}
          </ScrollView>

          {/* Page indicators */}
          <View style={styles.pageIndicators}>
            {widgetRefs.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.pageIndicator,
                  {
                    backgroundColor:
                      currentPage === index ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>

          {/* Share buttons */}
          <View style={styles.shareButtons}>
            <TouchableOpacity
              style={styles.instagramButton}
              onPress={handleShareInstagram}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#833AB4', '#C13584', '#E1306C', '#FD1D1D', '#F77737']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.instagramGradient}
              >
                <Ionicons
                  name="logo-instagram"
                  size={18}
                  color="#FFFFFF"
                  style={styles.instagramIcon}
                />
                <Text style={styles.shareButtonText}>Stories</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: colors.border }]}
              onPress={handleShareGeneral}
              activeOpacity={0.8}
            >
              <Ionicons
                name="share-outline"
                size={18}
                color={colors.text}
                style={styles.moreIcon}
              />
              <Text style={[styles.shareButtonText, { color: colors.text }]}>
                More
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '92%',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  handleBar: {
    width: 36,
    height: 5,
    backgroundColor: '#D1D1D6',
    borderRadius: 3,
    marginBottom: 16,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollViewContent: {
    alignItems: 'center',
  },
  widgetPage: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  pageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  shareButtons: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
  },
  instagramButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  instagramGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  instagramIcon: {
    marginTop: -1,
  },
  shareButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  moreIcon: {
    marginTop: -1,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
