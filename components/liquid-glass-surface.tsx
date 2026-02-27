import { useTheme } from '@/contexts/theme-context'
import {
  GlassView,
  type GlassViewProps,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import {
  AppState,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'

interface LiquidGlassSurfaceProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  fallbackStyle?: StyleProp<ViewStyle>
  glassEffectStyle?: GlassViewProps['glassEffectStyle']
  tintColor?: GlassViewProps['tintColor']
  isInteractive?: GlassViewProps['isInteractive']
  debugLabel?: string
}

function readGlassAvailability() {
  if (Platform.OS !== 'ios') {
    return {
      liquidGlassAvailable: false,
      glassApiAvailable: false,
      canUseNativeGlass: false,
    }
  }

  const liquidGlassAvailable = isLiquidGlassAvailable()
  const glassApiAvailable = isGlassEffectAPIAvailable()
  return {
    liquidGlassAvailable,
    glassApiAvailable,
    canUseNativeGlass: liquidGlassAvailable && glassApiAvailable,
  }
}

export function LiquidGlassSurface({
  children,
  style,
  fallbackStyle,
  glassEffectStyle = 'regular',
  tintColor,
  isInteractive = false,
  debugLabel,
}: LiquidGlassSurfaceProps) {
  const { isDark } = useTheme()
  const [availability, setAvailability] = useState(readGlassAvailability)
  const [themeRenderKey, setThemeRenderKey] = useState(0)

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    const refreshAvailability = (reason: 'theme-change' | 'retry' | 'app-active') => {
      const next = readGlassAvailability()
      if (!cancelled) {
        setAvailability(next)
      }

      // During theme/app transitions iOS can transiently report unavailable; retry for a short window.
      if (!next.canUseNativeGlass && attempts < 18 && !cancelled) {
        attempts += 1
        timeoutId = setTimeout(() => refreshAvailability('retry'), 180)
      }
    }

    // Force remount GlassView on theme changes to avoid stale native layer state.
    setThemeRenderKey((prev) => prev + 1)
    refreshAvailability('theme-change')

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        attempts = 0
        refreshAvailability('app-active')
      }
    })

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      appStateSubscription.remove()
    }
  }, [debugLabel, isDark])

  const { canUseNativeGlass } = availability
  const glassKey = useMemo(
    () => `glass-${isDark ? 'dark' : 'light'}-${themeRenderKey}`,
    [isDark, themeRenderKey],
  )

  if (canUseNativeGlass) {
    return (
      <GlassView
        key={glassKey}
        style={[
          styles.base,
          isDark ? styles.nativeVisibilityDark : styles.nativeVisibilityLight,
          style,
        ]}
        glassEffectStyle={glassEffectStyle}
        tintColor={tintColor}
        isInteractive={isInteractive}
      >
        {children}
      </GlassView>
    )
  }

  return (
    <View
      style={[
        styles.base,
        isDark ? styles.fallbackDark : styles.fallbackLight,
        fallbackStyle,
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  fallbackLight: {
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  fallbackDark: {
    backgroundColor: 'rgba(36,36,36,0.68)',
  },
  nativeVisibilityLight: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nativeVisibilityDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
})
