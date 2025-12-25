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
            backgroundColor: colors.backgroundWhite,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Left: Icon Circle */}
        <View
          style={[
            styles.iconRing,
            {
              backgroundColor: isDark ? '#3B82F630' : '#EBF5FF',
              borderColor: '#3B82F6',
            },
          ]}
        >
          <Ionicons name="compass" size={24} color="#3B82F6" />
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
              backgroundColor: colors.backgroundLight,
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
    borderRadius: 16,
    borderWidth: 1.5,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0, // Using background for color
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
})
