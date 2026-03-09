import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { TutorialChecklist } from '@/components/Tutorial/TutorialChecklist'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function TutorialScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const { trackEvent } = useAnalytics()

  useEffect(() => {
    trackEvent(AnalyticsEvents.TUTORIAL_VIEWED)
  }, [trackEvent])

  const handleBack = () => {
    haptic('light')
    router.back()
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top']}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header with back button */}
      <BaseNavbar
        leftContent={
          <NavbarIsland>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </NavbarIsland>
        }
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TutorialChecklist />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
})
