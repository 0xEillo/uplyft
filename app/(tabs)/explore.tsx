import { ExerciseLeaderboardCard } from '@/components/exercise-leaderboard-card'
import { MuscleBalanceChart } from '@/components/muscle-balance-chart'
import { StrengthScoreChart } from '@/components/strength-score-chart'
import { WorkoutChat } from '@/components/workout-chat'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useAnalytics } from '@/contexts/analytics-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import AsyncStorage from '@react-native-async-storage/async-storage'
import SwipeTutorialOverlay from '@/components/SwipeTutorialOverlay'

type TabType = 'progress' | 'chat'

// Swipe gesture thresholds
const SWIPE_EDGE_THRESHOLD = 50 // Minimum X position to start swipe (avoid edge gestures)
const SWIPE_DISTANCE_THRESHOLD = -80 // Minimum horizontal distance for swipe
const SWIPE_VELOCITY_THRESHOLD = -300 // Minimum velocity to trigger navigation

// Swipe tutorial configuration
const PROFILE_VISIT_COUNT_KEY = 'profilePageVisitCount'
const HAS_VISITED_BODY_LOG_KEY = 'hasVisitedBodyLog'
const TUTORIAL_DELAY_MS = 6000

export default function ProfileScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showTutorial, setShowTutorial] = useState(false)
  const startX = useRef(0)
  const tutorialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshTrigger((prev) => prev + 1) // Trigger components to refresh
    // Give components time to refresh their data
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setRefreshing(false)
  }, [])

  useEffect(() => {
    trackEvent('Explore Viewed', {
      timestamp: Date.now(),
    })
  }, [trackEvent])

  // Tutorial logic: track visits and show tutorial if needed
  useFocusEffect(
    useCallback(() => {
      const handleTutorialLogic = async () => {
        try {
          // Check if user has already visited body log
          const hasVisitedBodyLog = await AsyncStorage.getItem(HAS_VISITED_BODY_LOG_KEY)

          if (hasVisitedBodyLog === 'true') {
            return
          }

          // Get current visit count
          const visitCountStr = await AsyncStorage.getItem(PROFILE_VISIT_COUNT_KEY)
          const visitCount = visitCountStr ? parseInt(visitCountStr, 10) : 0

          // Increment visit count
          const newVisitCount = visitCount + 1
          await AsyncStorage.setItem(PROFILE_VISIT_COUNT_KEY, newVisitCount.toString())

          // Show tutorial starting from 2nd visit onwards
          if (newVisitCount >= 2) {
            tutorialTimerRef.current = setTimeout(() => {
              setShowTutorial(true)
            }, TUTORIAL_DELAY_MS)
          }
        } catch (error) {
          console.error('Error handling tutorial logic:', error)
        }
      }

      handleTutorialLogic()

      // Cleanup timer when screen loses focus
      return () => {
        if (tutorialTimerRef.current) {
          clearTimeout(tutorialTimerRef.current)
        }
      }
    }, [])
  )

  const handleTutorialDismiss = useCallback(() => {
    setShowTutorial(false)
  }, [])

  // Navigation function to be called from gesture handler
  const handleSwipeNavigation = useCallback(() => {
    router.push('/body-log')
  }, [])

  const handleSettingsPress = useCallback(() => {
    router.push('/settings')
  }, [])

  // Swipe left to navigate to body-log
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((event) => {
          startX.current = event.x
        })
        .onEnd((event) => {
          // Only trigger if swipe didn't start from the left edge (avoid native back gesture)
          // Detect left swipe (negative translationX and negative velocityX)
          if (
            startX.current > SWIPE_EDGE_THRESHOLD &&
            event.translationX < SWIPE_DISTANCE_THRESHOLD &&
            event.velocityX < SWIPE_VELOCITY_THRESHOLD
          ) {
            // Use runOnJS to execute navigation on the JS thread
            runOnJS(handleSwipeNavigation)()
          }
        }),
    [handleSwipeNavigation]
  )

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          onPress={handleSettingsPress}
          accessibilityLabel="Settings"
          accessibilityRole="button"
          accessibilityHint="Navigate to settings page"
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={swipeGesture}>
        <View style={styles.gestureContainer}>
          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
              onPress={() => setActiveTab('chat')}
              accessibilityLabel="Chat tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'chat' }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'chat' && styles.activeTabText,
                ]}
              >
                Chat
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
              onPress={() => setActiveTab('progress')}
              accessibilityLabel="Stats tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'progress' }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'progress' && styles.activeTabText,
                ]}
              >
                Stats
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'progress' ? (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                  progressBackgroundColor={colors.white}
                />
              }
            >
              {user && (
                <>
                  <ExerciseLeaderboardCard
                    userId={user.id}
                    refreshTrigger={refreshTrigger}
                  />
                  <StrengthScoreChart userId={user.id} />
                  <MuscleBalanceChart userId={user.id} />
                </>
              )}
            </ScrollView>
          ) : (
            <WorkoutChat />
          )}
        </View>
      </GestureDetector>

      {/* Tutorial Overlay */}
      {showTutorial && <SwipeTutorialOverlay onDismiss={handleTutorialDismiss} />}
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    gestureContainer: {
      flex: 1,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    headerIcon: {
      width: 32,
      height: 32,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activeTab: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    activeTabText: {
      color: colors.primary,
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: {
      paddingTop: 16,
      paddingBottom: 20,
    },
  })
