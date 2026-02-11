import { useTheme } from '@/contexts/theme-context'
import {
  GlassView,
  type GlassViewProps,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'
const LIQUID_GLASS_DEBUG = false
interface LiquidGlassSurfaceProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  fallbackStyle?: StyleProp<ViewStyle>
  glassEffectStyle?: GlassViewProps['glassEffectStyle']
  tintColor?: GlassViewProps['tintColor']
  isInteractive?: GlassViewProps['isInteractive']
  debugLabel?: string
  /**
   * Forces a native glass layer refresh without remounting children.
   * Useful when iOS drops glass rendering after route transitions.
   */
  refreshToken?: string | number
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
  refreshToken,
}: LiquidGlassSurfaceProps) {
  const { isDark } = useTheme()
  const [availability, setAvailability] = useState(readGlassAvailability)
  const [themeRenderKey, setThemeRenderKey] = useState(0)
  const previousModeRef = useRef<'native' | 'fallback' | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    const refreshAvailability = (
      reason: 'theme-change' | 'retry' | 'app-active' | 'refresh-token',
    ) => {
      const next = readGlassAvailability()
      if (!cancelled) {
        setAvailability(next)
      }

      if (__DEV__ && debugLabel && LIQUID_GLASS_DEBUG) {
        console.log('[liquid-glass][check]', {
          debugLabel,
          reason,
          attempt: attempts,
          isDark,
          platform: Platform.OS,
          liquidGlassAvailable: next.liquidGlassAvailable,
          glassApiAvailable: next.glassApiAvailable,
          mode: next.canUseNativeGlass ? 'native' : 'fallback',
        })
      }

      // During theme/app transitions iOS can transiently report unavailable; retry for a short window.
      if (!next.canUseNativeGlass && attempts < 18 && !cancelled) {
        attempts += 1
        timeoutId = setTimeout(() => refreshAvailability('retry'), 180)
      }
    }

    // Force remount GlassView on theme changes and explicit refreshes
    // to avoid stale native layer state.
    setThemeRenderKey((prev) => prev + 1)
    refreshAvailability(refreshToken === undefined ? 'theme-change' : 'refresh-token')

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
  }, [debugLabel, isDark, refreshToken])

  const { liquidGlassAvailable, glassApiAvailable, canUseNativeGlass } = availability
  const glassKey = useMemo(
    () => `glass-${isDark ? 'dark' : 'light'}-${themeRenderKey}`,
    [isDark, themeRenderKey],
  )

  useEffect(() => {
    if (!__DEV__ || !debugLabel || !LIQUID_GLASS_DEBUG) return
    const mode: 'native' | 'fallback' = canUseNativeGlass ? 'native' : 'fallback'
    const prevMode = previousModeRef.current
    previousModeRef.current = mode

    console.log('[liquid-glass]', {
      debugLabel,
      mode,
      prevMode,
      changed: prevMode !== null ? prevMode !== mode : false,
      isDark,
      platform: Platform.OS,
      liquidGlassAvailable,
      glassApiAvailable,
    })
  }, [
    canUseNativeGlass,
    debugLabel,
    glassApiAvailable,
    isDark,
    liquidGlassAvailable,
  ])

  if (canUseNativeGlass) {
    return (
      <View
        style={[
          styles.base,
          isDark ? styles.nativeVisibilityDark : styles.nativeVisibilityLight,
          style,
        ]}
      >
        <GlassView
          key={glassKey}
          pointerEvents={isInteractive ? 'auto' : 'none'}
          style={styles.nativeGlassFill}
          glassEffectStyle={glassEffectStyle}
          tintColor={tintColor}
          isInteractive={isInteractive}
        />
        {children}
      </View>
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
  nativeGlassFill: {
    ...StyleSheet.absoluteFillObject,
  },
  fallbackLight: {
    backgroundColor: 'rgba(255,255,255,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  fallbackDark: {
    backgroundColor: 'rgba(36,36,36,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  nativeVisibilityLight: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  nativeVisibilityDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
})
