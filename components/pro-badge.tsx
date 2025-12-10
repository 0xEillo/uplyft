import { Pressable, StyleSheet, Text } from 'react-native'
import { useThemedColors } from '@/hooks/useThemedColors'

interface ProBadgeProps {
  onPress?: () => void
  size?: 'small' | 'medium' | 'large'
}

export function ProBadge({ onPress, size = 'medium' }: ProBadgeProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const sizeStyle = size === 'small' ? styles.badgeSmall : size === 'large' ? styles.badgeLarge : styles.badgeMedium
  const textStyle = size === 'small' ? styles.textSmall : size === 'large' ? styles.textLarge : styles.textMedium

  const BadgeContent = (
    <>
      <Text style={textStyle}>PRO</Text>
    </>
  )

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[styles.badge, sizeStyle]} android_ripple={{ color: 'rgba(0, 0, 0, 0.1)' }}>
        {BadgeContent}
      </Pressable>
    )
  }

  return <Text style={[styles.badge, sizeStyle, { backgroundColor: colors.primary, paddingHorizontal: 12 }]}>{BadgeContent}</Text>
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeSmall: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeMedium: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    badgeLarge: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    textSmall: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.white,
    },
    textMedium: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.white,
    },
    textLarge: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.white,
    },
  })
