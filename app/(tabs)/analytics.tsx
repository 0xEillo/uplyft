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

  const toggleViewMode = useCallback(() => {
    setViewMode((current) => (current === 'stats' ? bodyTab : 'stats'))
  }, [bodyTab])

  const handleTitlePress = useCallback(() => {
    // Light haptic feedback
    haptic('light')

    // If in stats view, switch back to body tab view
    if (viewMode === 'stats') {
      setViewMode(bodyTab)
      return
    }

    // Toggle between strength and recovery
    const newTab = bodyTab === 'strength' ? 'recovery' : 'strength'
    setBodyTab(newTab)
    setViewMode(newTab)
  }, [bodyTab, viewMode])

  const getViewIcon = (): keyof typeof Ionicons.glyphMap => {
    return viewMode === 'stats' ? 'body' : 'stats-chart'
  }

  // Show swap icon only when not in stats view
  const showSwapIcon = viewMode !== 'stats'

  const styles = createStyles(colors)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={
          <NavbarIsland>
            <TouchableOpacity
              style={styles.titleButton}
              onPress={handleTitlePress}
              activeOpacity={0.7}
            >
              <Text style={styles.headerTitle}>{VIEW_LABELS[viewMode]}</Text>
              {showSwapIcon && (
                <Ionicons
                  name="swap-horizontal"
                  size={16}
                  color={colors.textSecondary}
                  style={styles.swapIcon}
                />
              )}
            </TouchableOpacity>
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
      backgroundColor: colors.background,
    },
    titleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    swapIcon: {
      marginTop: 1,
    },
  })
