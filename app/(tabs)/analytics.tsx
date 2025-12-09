import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { StatsView } from '@/components/StatsView'
import { StrengthStandardsView } from '@/components/StrengthStandardsView'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type ViewMode = 'standards' | 'stats'

export default function AnalyticsScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('standards')

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
      <BaseNavbar
        leftContent={
          <NavbarIsland>
            <Text style={styles.headerTitle}>Progress</Text>
          </NavbarIsland>
        }
        rightContent={
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity
              onPress={() => setViewMode(viewMode === 'standards' ? 'stats' : 'standards')}
              style={{ padding: 4 }}
            >
              <Ionicons
                name={viewMode === 'standards' ? 'stats-chart' : 'barbell'}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/body-log')}
              style={{ padding: 4 }}
            >
              <Ionicons name="body-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        }
      />

      {viewMode === 'stats' ? (
        user && <StatsView userId={user.id} />
      ) : (
        <StrengthStandardsView />
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
