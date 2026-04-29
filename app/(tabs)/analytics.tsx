import { BaseNavbar } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { Layout } from '@/constants/theme'
import { StrengthBodyView } from '@/components/StrengthBodyView'
import { StrengthProgressTutorial } from '@/components/StrengthProgressTutorial'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { runAfterInteractions } from '@/lib/utils/run-after-interactions'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const NAVBAR_HEIGHT = Layout.navbarHeight

export default function AnalyticsScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const [showStrengthTutorial, setShowStrengthTutorial] = useState(false)
  const [strengthScrollLocked, setStrengthScrollLocked] = useState(false)

  const strengthTutorialSeenKey = user?.id
    ? `strength_progress_tutorial_seen_${user.id}`
    : null

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.ANALYTICS_VIEWED, {
        timestamp: Date.now(),
      })

      if (!strengthTutorialSeenKey) {
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
    }, [strengthTutorialSeenKey, trackEvent]),
  )

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
    <View collapsable={false} style={styles.container}>
      <BlurredHeader>
        <BaseNavbar
          leftContent={
            <Text style={styles.headerTitle} numberOfLines={1}>
              Progress
            </Text>
          }
          rightContent={<View style={styles.navbarSpacer} />}
        />
      </BlurredHeader>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: contentTopPadding },
        ]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ top: contentTopPadding }}
        scrollEnabled={!strengthScrollLocked}
      >
        <StrengthBodyView
          embedded
          onWeightGateActiveChange={setStrengthScrollLocked}
        />
      </ScrollView>

      <StrengthProgressTutorial
        visible={showStrengthTutorial}
        onComplete={handleStrengthTutorialComplete}
      />
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      marginLeft: 6,
    },
    navbarSpacer: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 10,
    },
  })
