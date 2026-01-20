import { useThemedColors } from '@/hooks/useThemedColors'
import { StyleSheet, Text } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

interface NotificationBadgeProps {
  count: number
}

export function NotificationBadge({ count }: NotificationBadgeProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  if (count === 0) return null

  return (
    <Animated.View
      style={styles.badge}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  )
}

function createStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    badge: {
      position: 'absolute',
      top: -4,
      right: -8,
      backgroundColor: '#EF4444',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
      borderWidth: 2,
      borderColor: colors.bg,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
  })
}
