import { StrengthBodyLocked } from '@/components/StrengthBodyLocked'
import { StrengthBodyView } from '@/components/StrengthBodyView'
import { StrengthProgressTutorial } from '@/components/StrengthProgressTutorial'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { runAfterInteractions } from '@/lib/utils/run-after-interactions'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function AnalyticsScreen() {
  const { user } = useAuth()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const { isProMember } = useSubscription()
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

      if (!isProMember) return
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
    }, [isProMember, strengthTutorialSeenKey, trackEvent]),
  )

  const handleStrengthTutorialComplete = useCallback(() => {
    setShowStrengthTutorial(false)
    if (strengthTutorialSeenKey) {
      AsyncStorage.setItem(strengthTutorialSeenKey, 'true')
    }
  }, [strengthTutorialSeenKey])

  const styles = createStyles(colors)
  const insets = useSafeAreaInsets()
  const contentTopPadding = insets.top

  return (
    <View collapsable={false} style={styles.container}>
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
        {isProMember ? (
          <StrengthBodyView
            embedded
            onWeightGateActiveChange={setStrengthScrollLocked}
          />
        ) : (
          <StrengthBodyLocked />
        )}
      </ScrollView>

      {isProMember && (
        <StrengthProgressTutorial
          visible={showStrengthTutorial}
          onComplete={handleStrengthTutorialComplete}
        />
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 10,
    },
  })
