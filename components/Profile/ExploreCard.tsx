import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { memo, useCallback } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

export const ExploreCard = memo(() => {
  const colors = useThemedColors()
  const router = useRouter()
  const { isDark } = useTheme()

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/explore')
  }, [router])

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.wrapper}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          styles.container,
          {
            backgroundColor: colors.feedCardBackground,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Left: Icon Container */}
        <View style={styles.iconContainer}>
          <Ionicons name="compass-outline" size={24} color={colors.primary} />
        </View>

        {/* Middle: Content */}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            Explore
          </Text>
        </View>

        {/* Right: Arrow */}
        <View
          style={[
            styles.arrowContainer,
            {
              backgroundColor: colors.background,
            },
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
})

ExploreCard.displayName = 'ExploreCard'

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  arrowContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
})
