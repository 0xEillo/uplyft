import { BaseNavbar } from '@/components/base-navbar'
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
import { useCallback, useEffect, useRef, useState } from 'react'
import {
    Animated,
    LayoutChangeEvent,
    Pressable,
    StyleSheet,
    Text,
    View,
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
  
  // Animation for the sliding pill indicator
  const slideAnim = useRef(new Animated.Value(0)).current
  const [tabWidth, setTabWidth] = useState(0)

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

  const handleTabLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout
    setTabWidth(width / 2)
  }, [])

  const styles = createStyles(colors)

  // Calculate the translateX for the sliding indicator
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, tabWidth + 4], // 4px padding offset
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BaseNavbar
        leftContent={<View style={styles.navbarSpacer} />}
        rightContent={<View style={styles.navbarSpacer} />}
        centerContent={
          <View style={styles.segmentedControl} onLayout={handleTabLayout}>
            {/* Animated sliding background */}
            <Animated.View
              style={[
                styles.slideIndicator,
                {
                  width: tabWidth - 8,
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

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
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
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: 4,
      position: 'relative',
    },
    slideIndicator: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      backgroundColor: colors.surfaceCard,
      borderRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      zIndex: 1,
    },
    tabIcon: {
      marginRight: 6,
    },
    tabLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabLabelActive: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
  })
