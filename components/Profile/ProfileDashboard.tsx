import { useTutorial } from '@/contexts/tutorial-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { memo } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

interface ProfileDashboardProps {
  activeRoutineName: string | null
  latestWeight: number | null
}

export const ProfileDashboard = memo(
  ({ activeRoutineName, latestWeight }: ProfileDashboardProps) => {
    const colors = useThemedColors()
    const router = useRouter()
    const {
      tutorialSteps,
      completedSteps,
      isTutorialComplete,
      isTutorialDismissed,
    } = useTutorial()

    const isTrialActive = !isTutorialDismissed && !isTutorialComplete

    const DashboardButton = ({
      title,
      icon,
      onPress,
      color,
      isFullWidth = false,
    }: {
      title: string
      icon: keyof typeof Ionicons.glyphMap
      onPress: () => void
      color?: string
      isFullWidth?: boolean
    }) => (
      <TouchableOpacity
        onPress={() => {
          haptic('light')
          onPress()
        }}
        activeOpacity={0.7}
        style={[
          styles.button,
          {
            backgroundColor: colors.feedCardBackground,
            borderColor: colors.border,
            width: isFullWidth ? '100%' : '48.5%',
          },
        ]}
      >
        <View style={styles.buttonIconContainer}>
          <Ionicons name={icon} size={24} color={color || colors.textSecondary} />
        </View>
        <Text style={[styles.buttonTitle, { color: colors.text }]}>{title}</Text>
      </TouchableOpacity>
    )

    const TrialButton = () => {
      const completedCount = completedSteps.size
      const totalSteps = tutorialSteps.length

      return (
        <TouchableOpacity
          onPress={() => {
            haptic('light')
            router.push('/tutorial')
          }}
          activeOpacity={0.7}
          style={[
            styles.button,
            {
              backgroundColor: colors.primary + '10',
              borderColor: colors.primary + '30',
              width: '100%',
              marginBottom: 10,
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.buttonIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="school" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.buttonTitle, { color: colors.primary }]}>Tutorial</Text>
          </View>
          
          <View style={[styles.stepsBadge, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.stepsText, { color: colors.primary }]}>{completedCount}/{totalSteps} steps</Text>
          </View>
        </TouchableOpacity>
      )
    }

    return (
      <View style={styles.container}>
        <View style={styles.grid}>
          {isTrialActive && <TrialButton />}
          
          <DashboardButton
            title="Explore"
            icon="compass-outline"
            onPress={() => router.push('/explore')}
          />
          <DashboardButton
            title="Body Log"
            icon="body-outline"
            onPress={() => router.push('/body-log')}
          />
        </View>
      </View>
    )
  },
)

ProfileDashboard.displayName = 'ProfileDashboard'

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  buttonIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  stepsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stepsText: {
    fontSize: 13,
    fontWeight: '700',
  },
})
