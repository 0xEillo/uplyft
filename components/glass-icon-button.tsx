import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { Ionicons } from '@expo/vector-icons'
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native'

interface GlassIconButtonProps {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  color?: string
  size?: number
  style?: StyleProp<ViewStyle>
  activeOpacity?: number
  /** If true, disables the touch interaction */
  disabled?: boolean
  /** Additional children to render inside the button (e.g. badges) */
  children?: React.ReactNode
}

/**
 * An icon button wrapped in a LiquidGlassSurface for the glass effect.
 * Use this for all navbar/header icon buttons (back, share, settings, menu, etc.)
 * Do NOT use for text/title elements.
 */
export function GlassIconButton({
  icon,
  onPress,
  color = '#FFFFFF',
  size = 24,
  style,
  activeOpacity = 0.7,
  disabled = false,
  children,
}: GlassIconButtonProps) {
  return (
    <LiquidGlassSurface style={[styles.container, style]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={activeOpacity}
        disabled={disabled}
        style={styles.touchable}
      >
        <Ionicons name={icon} size={size} color={color} />
        {children}
      </TouchableOpacity>
    </LiquidGlassSurface>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchable: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
