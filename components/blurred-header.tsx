import { useTheme } from '@/contexts/theme-context'
import MaskedView from '@react-native-masked-view/masked-view'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { ReactNode } from 'react'
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * How many extra pixels the blur zone extends beyond the header content.
 * A larger value = more gradual fade.
 */
const FADE_EXTENSION = 40

interface BlurredHeaderProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Blur intensity (0-100). Default 80. */
  intensity?: number
  disableBlur?: boolean
}

/**
 * Translucent blurred header with a **seamless fade-out** at the bottom.
 *
 * The trick: we wrap a full-height `BlurView` inside a `MaskedView` whose
 * mask is a `LinearGradient` going from opaque → transparent.  The blur
 * itself fades out smoothly — no hard edge, no visible line.
 */
export function BlurredHeader({
  children,
  style,
  intensity = 20,
  disableBlur = false,
}: BlurredHeaderProps) {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()

  if (disableBlur || Platform.OS === 'android') {
    return (
      <View
        style={[
          styles.outerContainer,
          { paddingTop: insets.top },
          isDark ? styles.fallbackDark : styles.fallbackLight,
          style,
        ]}
      >
        {children}
      </View>
    )
  }

  return (
    <View style={[styles.outerContainer, style]} pointerEvents="box-none">
      {/* MaskedView makes the BlurView + gradient fade out smoothly */}
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            colors={['black', 'black', 'transparent']}
            locations={[0, 0.65, 1]}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        <BlurView
          intensity={intensity}
          tint="default"
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>

      {/* The actual header content, positioned in the safe area */}
      <View style={{ paddingTop: insets.top }} pointerEvents="box-none">
        {children}
      </View>

      {/* Extra transparent spacer for the fade zone — no interaction */}
      <View style={{ height: FADE_EXTENSION }} pointerEvents="none" />
    </View>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  fallbackDark: {
    backgroundColor: 'rgba(17, 17, 17, 0.88)',
  },
  fallbackLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
})
