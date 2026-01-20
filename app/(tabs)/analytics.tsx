import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { RecoveryBodyView } from '@/components/RecoveryBodyView'
import { StatsView } from '@/components/StatsView'
import { StrengthBodyView } from '@/components/StrengthBodyView'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type ViewMode = 'recovery' | 'strength' | 'stats'
type BodyTab = 'recovery' | 'strength'

const VIEW_LABELS: Record<ViewMode, string> = {
  recovery: 'Recovery',
  strength: 'Strength',
  stats: 'Stats',
}

export default function AnalyticsScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const [viewMode, setViewMode] = useState<ViewMode>('strength')
  const [bodyTab, setBodyTab] = useState<BodyTab>('strength')

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.ANALYTICS_VIEWED, {
        timestamp: Date.now(),
      })
    }, [trackEvent]),
  )

  // NOTE: Stats view toggle functions - currently not in use (feature hidden)
  // Kept for potential future re-enablement
  const toggleViewMode = useCallback(() => {
    setViewMode((current) => (current === 'stats' ? bodyTab : 'stats'))
  }, [bodyTab])

  const getViewIcon = (): keyof typeof Ionicons.glyphMap => {
    return viewMode === 'stats' ? 'body' : 'stats-chart'
  }

  const showSwapIcon = viewMode !== 'stats'
  // END: Stats view toggle functions

  const handleTitlePress = useCallback(() => {
    // Light haptic feedback
    haptic('light')

    // Toggle between strength and recovery
    const newTab = bodyTab === 'strength' ? 'recovery' : 'strength'
    setBodyTab(newTab)
    setViewMode(newTab)
  }, [bodyTab])

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={
          <NavbarIsland>
            <Text style={styles.headerTitle}>{VIEW_LABELS[viewMode]}</Text>
          </NavbarIsland>
        }
        rightContent={
          <TouchableOpacity
            onPress={handleTitlePress}
            style={{ padding: 4 }}
          >
            <Ionicons
              name="swap-horizontal"
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        }
      />

      {/* Content */}
      {viewMode === 'stats' ? (
        user && <StatsView userId={user.id} />
      ) : viewMode === 'recovery' ? (
        <RecoveryBodyView />
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
      backgroundColor: colors.bg,
    },
    titleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    swapIcon: {
      marginTop: 1,
    },
  })
