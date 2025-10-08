import { ExerciseLeaderboardCard } from '@/components/exercise-leaderboard-card'
import { MuscleBalanceChart } from '@/components/muscle-balance-chart'
import { StrengthScoreChart } from '@/components/strength-score-chart'
import { WorkoutChat } from '@/components/workout-chat'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type TabType = 'progress' | 'chat'

export default function ProfileScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<TabType>('progress')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshTrigger((prev) => prev + 1) // Trigger components to refresh
    // Give components time to refresh their data
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setRefreshing(false)
  }, [])

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={
              isDark
                ? require('@/llm/bellwhite.png')
                : require('@/llm/bellblack.png')
            }
            style={styles.headerIcon}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
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
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerIcon: {
      width: 28,
      height: 28,
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
      paddingTop: 14,
    },
  })
