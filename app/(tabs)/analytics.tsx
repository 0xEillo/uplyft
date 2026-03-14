import { BaseNavbar } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { RecoveryBodyView } from '@/components/RecoveryBodyView'
import { StatsView } from '@/components/StatsView'
import { StrengthProgressTutorial } from '@/components/StrengthProgressTutorial'
import { StrengthBodyView } from '@/components/StrengthBodyView'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { runAfterInteractions } from '@/lib/utils/run-after-interactions'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
    Animated,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const NAVBAR_HEIGHT = 76

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
  const [glassInstanceKey, setGlassInstanceKey] = useState(0)
  const [showStrengthTutorial, setShowStrengthTutorial] = useState(false)
  
  // Constants for perfect centering
  const CONTROL_WIDTH = 210
  const TAB_WIDTH = CONTROL_WIDTH / 2
  const PILL_PADDING = 3
  
  // Animation for the sliding pill indicator
  const indicatorLeft = useRef(new Animated.Value(PILL_PADDING)).current
  const strengthTutorialSeenKey = user?.id
    ? `strength_progress_tutorial_seen_${user.id}`
    : null

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.ANALYTICS_VIEWED, {
        timestamp: Date.now(),
      })

      // Force remount on focus to recover native glass if iOS drops it after transitions.
      setGlassInstanceKey((prev) => prev + 1)

      if (bodyTab !== 'strength' || !strengthTutorialSeenKey) {
        return
      }

      let cancelled = false
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      const interactionHandle = runAfterInteractions(() => {
        timeoutId = setTimeout(() => {
          AsyncStorage.getItem(strengthTutorialSeenKey).then((value) => {
            if (!cancelled && !value) {
              setShowStrengthTutorial(true)
            }
          })
        }, 450)
      })

      return () => {
        cancelled = true
        interactionHandle.cancel?.()
        if (timeoutId) clearTimeout(timeoutId)
      }
    }, [bodyTab, strengthTutorialSeenKey, trackEvent]),
  )

  // Animate the pill indicator when tab changes
  useEffect(() => {
    const toValue =
      bodyTab === 'strength' ? PILL_PADDING : TAB_WIDTH + PILL_PADDING
    Animated.spring(indicatorLeft, {
      toValue,
      // Keep this on JS driver; native transform animation can cause glass layers
      // to intermittently fail to render after navigation transitions.
      useNativeDriver: false,
      tension: 300,
      friction: 30,
    }).start()
  }, [TAB_WIDTH, bodyTab, indicatorLeft, PILL_PADDING])

  const handleTabPress = useCallback((tab: BodyTab) => {
    if (tab === bodyTab) return
    
    haptic('light')
    setBodyTab(tab)
    setViewMode(tab)
  }, [bodyTab])

  const handleStrengthTutorialComplete = useCallback(() => {
    setShowStrengthTutorial(false)
    if (strengthTutorialSeenKey) {
      AsyncStorage.setItem(strengthTutorialSeenKey, 'true')
    }
  }, [strengthTutorialSeenKey])

  const styles = createStyles(colors)
  const insets = useSafeAreaInsets()
  const headerTotalHeight = insets.top + NAVBAR_HEIGHT
  const contentTopPadding = Math.max(0, headerTotalHeight - 36)

  return (
    <View
      collapsable={false}
      style={styles.container}
    >
      <BlurredHeader>
        <BaseNavbar
          leftContent={<View style={styles.navbarSpacer} />}
          rightContent={<View style={styles.navbarSpacer} />}
          centerGlass={false}
          centerContent={
            <View style={styles.segmentedWrapper}>
              <View style={styles.segmentedControl}>
                {/* Animated sliding background */}
                <Animated.View
                  style={[
                    styles.slideIndicator,
                    {
                      width: TAB_WIDTH - PILL_PADDING * 2,
                      left: indicatorLeft,
                    },
                  ]}>
                  <LiquidGlassSurface
                    key={`analytics-pill-${glassInstanceKey}`}
                    style={styles.activeTabBubble}
                    debugLabel="analytics-slider-pill"
                  />
                </Animated.View>

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
            </View>
          }
        />
      </BlurredHeader>

      {/* Content - ScrollView at screen level for native tab minimize detection */}
      {viewMode === 'stats' ? (
        user && <StatsView userId={user.id} />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: contentTopPadding }]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ top: contentTopPadding }}
        >
          {viewMode === 'recovery' ? (
            <RecoveryBodyView embedded />
          ) : (
            <StrengthBodyView embedded />
          )}
        </ScrollView>
      )}
      <StrengthProgressTutorial
        visible={showStrengthTutorial}
        onComplete={handleStrengthTutorialComplete}
      />
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    navbarSpacer: {
      width: 40, // Matches typical icon button width for balance
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    
    // Segmented Control Styles
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: 'transparent',
      position: 'relative',
      width: 210, // Match CONTROL_WIDTH
    },
    segmentedWrapper: {
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    slideIndicator: {
      position: 'absolute',
      top: 3, // Match PILL_PADDING
      bottom: 3, // Match PILL_PADDING
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    activeTabBubble: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 20,
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
