import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { StatsView } from '@/components/StatsView'
import { StrengthBodyView } from '@/components/StrengthBodyView'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
    StyleSheet,
    Text,
    TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type ViewMode = 'body' | 'stats'

export default function AnalyticsScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const [viewMode, setViewMode] = useState<ViewMode>('body')

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.ANALYTICS_VIEWED, {
        timestamp: Date.now(),
      })
    }, [trackEvent]),
  )

  const toggleViewMode = useCallback(() => {
    setViewMode((current) => (current === 'body' ? 'stats' : 'body'))
  }, [])

  const getViewIcon = (): keyof typeof Ionicons.glyphMap => {
    return viewMode === 'body' ? 'stats-chart' : 'body'
  }

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={
          <NavbarIsland>
            <Text style={styles.headerTitle}>Progress</Text>
          </NavbarIsland>
        }
        rightContent={
          <TouchableOpacity
            onPress={toggleViewMode}
            style={{ padding: 4 }}
          >
            <Ionicons
              name={getViewIcon()}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        }
      />

      {viewMode === 'stats' ? (
        user && <StatsView userId={user.id} />
      ) : (
        <StrengthBodyView />
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
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
  })
