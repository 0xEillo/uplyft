import { MuscleBalanceChart } from '@/components/muscle-balance-chart'
import { StrengthScoreChart } from '@/components/strength-score-chart'
import { WorkoutChat } from '@/components/workout-chat'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useAuth } from '@/contexts/auth-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import {
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
  const [activeTab, setActiveTab] = useState<TabType>('chat')

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
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
        >
          {user && (
            <>
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
  })
