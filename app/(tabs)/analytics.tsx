import { MuscleBalanceChart } from '@/components/muscle-balance-chart'
import { StrengthScoreChart } from '@/components/strength-score-chart'
import { WorkoutCalendarCard } from '@/components/workout-calendar-card'
import { WorkoutChat } from '@/components/workout-chat'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

type TabType = 'progress' | 'chat'

export default function AnalyticsScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [activeTab, setActiveTab] = useState<TabType>(
    (params.tab as TabType) || 'chat',
  )
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshTrigger((prev) => prev + 1) // Trigger components to refresh
    // Give components time to refresh their data
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setRefreshing(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.ANALYTICS_VIEWED, {
        timestamp: Date.now(),
      })
    }, [trackEvent]),
  )

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Status bar background to match navbar */}
      <View style={[styles.statusBarBackground, { height: insets.top }]} />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress</Text>
      </View>

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
                <WorkoutCalendarCard userId={user.id} />
                <StrengthScoreChart userId={user.id} />
                <MuscleBalanceChart userId={user.id} />
              </>
            )}
          </ScrollView>
        ) : (
          <WorkoutChat />
        )}
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    statusBarBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.white,
      zIndex: 0,
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
      paddingTop: 2,
      paddingBottom: 20,
    },
  })
