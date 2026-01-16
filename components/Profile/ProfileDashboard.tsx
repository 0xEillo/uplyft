import { useTutorial } from '@/contexts/tutorial-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { memo } from 'react'
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native'
import Animated, { FadeInLeft, Layout } from 'react-native-reanimated'

interface ProfileDashboardProps {
  activeRoutineName: string | null
  latestWeight: number | null
}

export const ProfileDashboard = memo(
  ({ activeRoutineName, latestWeight }: ProfileDashboardProps) => {
    const colors = useThemedColors()
    const router = useRouter()
    const { width } = useWindowDimensions()
    const {
      tutorialSteps,
      completedSteps,
      isTutorialComplete,
      isTutorialDismissed,
    } = useTutorial()

    const CARD_WIDTH = width * 0.42 // Slightly less than half width to show peek of next card
    const CARD_HEIGHT = 140

    const TutorialCard = () => {
      // Don't show if complete or dismissed
      if (isTutorialDismissed || isTutorialComplete) return null

      const completedCount = completedSteps.size
      const totalSteps = tutorialSteps.length
      const progress = completedCount / totalSteps

      return (
        <Animated.View
          entering={FadeInLeft.delay(100).duration(400)}
          layout={Layout.springify()}
        >
          <TouchableOpacity
            onPress={() => {
              haptic('light')
              router.push('/tutorial')
            }}
            activeOpacity={0.9}
            style={[
              styles.card,
              {
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                backgroundColor: colors.primary + '15', // Subtle primary tint
                borderColor: colors.primary + '30',
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: colors.primary + '20' },
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.primary}
                style={{ opacity: 0.8 }}
              />
            </View>

            <View style={styles.cardContent}>
              <Text
                style={[styles.cardLabel, { color: colors.primary }]}
                numberOfLines={1}
              >
                Let's Start
              </Text>
              <Text style={[styles.cardValue, { color: colors.text }]}>
                {completedCount}/{totalSteps}
              </Text>
              <Text
                style={[styles.cardSubtext, { color: colors.textSecondary }]}
              >
                Steps completed
              </Text>
            </View>

            {/* Progress Bar */}
            <View
              style={[
                styles.progressBarBg,
                { backgroundColor: colors.primary + '20' },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${progress * 100}%`,
                  },
                ]}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )
    }

    const StatCard = ({
      title,
      value,
      subtext,
      icon,
      onPress,
      color = colors.text,
      tintColor = colors.feedCardBackground,
    }: {
      title: string
      value: string
      subtext?: string
      icon: keyof typeof Ionicons.glyphMap
      onPress: () => void
      color?: string
      tintColor?: string
    }) => (
      <TouchableOpacity
        onPress={() => {
          haptic('light')
          onPress()
        }}
        activeOpacity={0.9}
        style={[
          styles.card,
          {
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundColor: tintColor,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: colors.background },
            ]}
          >
            <Ionicons name={icon} size={22} color={colors.textSecondary} />
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text
            style={[styles.cardLabel, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[styles.cardValue, { color }]}
            numberOfLines={2}
          >
            {value}
          </Text>
          {subtext && (
            <Text
              style={[styles.cardSubtext, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {subtext}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    )

    return (
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + 12}
        >
          {/* Tutorial Card (Conditional) */}
          <TutorialCard />

          {/* Explore Card */}
          <StatCard
            title="EXPLORE"
            value="Programs"
            icon="compass-outline"
            onPress={() => router.push('/explore')}
          />

          {/* Body Log Card */}
          <StatCard
            title="BODY LOG"
            value={latestWeight ? `${latestWeight.toFixed(1)} kg` : 'Log Weight'}
            icon="body-outline"
            onPress={() => router.push('/body-log')}
          />

          {/* Routines Card */}
          <StatCard
            title="ROUTINES"
            value={activeRoutineName || 'No Plan'}
            icon="albums-outline"
            onPress={() => router.push('/routines')}
          />
        </ScrollView>
      </View>
    )
  },
)

ProfileDashboard.displayName = 'ProfileDashboard'

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 14,
    gap: 12,
    paddingBottom: 4, // Space for shadow
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    justifyContent: 'space-between',
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    marginTop: 8,
    flex: 1,
    justifyContent: 'center', // Center vertically in space
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 2,
  },
  cardSubtext: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
})
