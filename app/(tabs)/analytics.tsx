import { BaseNavbar } from '@/components/base-navbar'
import { RecoveryBodyView } from '@/components/RecoveryBodyView'
import { StatsView } from '@/components/StatsView'
import { StrengthBodyView } from '@/components/StrengthBodyView'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type ViewMode = 'recovery' | 'strength' | 'stats'
type BodyTab = 'strength' | 'recovery'

const TABS: { key: BodyTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'strength', label: 'Strength', icon: 'barbell-outline' },
  { key: 'recovery', label: 'Recovery', icon: 'heart-outline' },
]

export default function AnalyticsScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const [viewMode, setViewMode] = useState<ViewMode>('strength')
  const [bodyTab, setBodyTab] = useState<BodyTab>('strength')
  
  // Constants for perfect centering
  const CONTROL_WIDTH = 210
  const TAB_WIDTH = CONTROL_WIDTH / 2
  const PILL_PADDING = 3
  const CONTROL_HEIGHT = 38
  
  // Animation for the sliding pill indicator
  const slideAnim = useRef(new Animated.Value(0)).current

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.ANALYTICS_VIEWED, {
        timestamp: Date.now(),
      })
    }, [trackEvent]),
  )

  // Animate the pill indicator when tab changes
  useEffect(() => {
    const toValue = bodyTab === 'strength' ? 0 : 1
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start()
  }, [bodyTab, slideAnim])

  const handleTabPress = useCallback((tab: BodyTab) => {
    if (tab === bodyTab) return
    
    haptic('light')
    setBodyTab(tab)
    setViewMode(tab)
  }, [bodyTab])

  const { isDark } = useTheme()
  const styles = createStyles(colors, isDark)

  // Calculate the translateX for the sliding indicator
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PILL_PADDING, TAB_WIDTH + PILL_PADDING],
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={<View style={styles.navbarSpacer} />}
        rightContent={<View style={styles.navbarSpacer} />}
        centerContent={
          <View style={styles.segmentedControl}>
            {/* Animated sliding background */}
            <Animated.View
              style={[
                styles.slideIndicator,
                {
                  width: TAB_WIDTH - PILL_PADDING * 2,
                  transform: [{ translateX }],
                },
              ]}
            />
            
            {/* Tab buttons */}
            {TABS.map((tab) => {
              const isActive = bodyTab === tab.key
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => handleTabPress(tab.key)}
                  style={styles.tabButton}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      isActive && styles.tabLabelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
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

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    navbarSpacer: {
      width: 40, // Matches typical icon button width for balance
    },
    
    // Segmented Control Styles
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: 'transparent',
      position: 'relative',
      width: 210, // Match CONTROL_WIDTH
    },
    slideIndicator: {
      position: 'absolute',
      top: 3, // Match PILL_PADDING
      bottom: 3, // Match PILL_PADDING
      backgroundColor: isDark ? '#262626' : '#F0F0F5',
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    tabButton: {
      flex: 1,
      height: 38, // Match CONTROL_HEIGHT
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    tabIcon: {
      marginRight: 6,
    },
    tabLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: -0.2,
    },
    tabLabelActive: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
  })
