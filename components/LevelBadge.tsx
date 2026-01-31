import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    Animated,
    Image,
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native'
import Svg, {
    Circle,
    Defs,
    Stop,
    LinearGradient as SvgLinearGradient,
} from 'react-native-svg'

// Helper to lighten a hex color
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const B = ((num >> 8) & 0x00ff) + amt
  const G = (num & 0x00ff) + amt

  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 +
      (G < 255 ? (G < 1 ? 0 : G) : 255)
    )
      .toString(16)
      .slice(1)
  )
}

type StrengthLevel =
  | 'Untrained'
  | 'Beginner'
  | 'Novice'
  | 'Intermediate'
  | 'Advanced'
  | 'Elite'
  | 'World Class'

const LEVEL_COLORS: Record<StrengthLevel, string> = {
  Untrained: '#6B7280',   // Darker Gray
  Beginner: '#9CA3AF',    // Gray
  Novice: '#3B82F6',      // Blue
  Intermediate: '#10B981', // Green
  Advanced: '#8B5CF6',    // Purple
  Elite: '#F59E0B',       // Orange
  'World Class': '#EF4444', // Red
}

interface LevelBadgeProps {
  level: StrengthLevel
  size?: 'small' | 'medium' | 'large' | 'xl' | 'hero'
  variant?: 'icon' | 'pill'
  style?: StyleProp<ViewStyle>
  showTooltipOnPress?: boolean
  iconOnly?: boolean
}

export function LevelBadge({
  level,
  size = 'medium',
  variant = 'icon',
  style,
  showTooltipOnPress = false,
  iconOnly = false,
}: LevelBadgeProps) {
  const color = LEVEL_COLORS[level]
  const [showTooltip, setShowTooltip] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const timeoutRef = useRef<any>(null)

  const dimensions = {
    small: { container: 26, icon: 16, border: 1, fontSize: 10, paddingH: 8, paddingV: 3 },
    medium: { container: 34, icon: 20, border: 1.5, fontSize: 11, paddingH: 10, paddingV: 4 },
    large: { container: 48, icon: 28, border: 2, fontSize: 13, paddingH: 14, paddingV: 6 },
    hero: { container: 80, icon: 48, border: 3, fontSize: 16, paddingH: 20, paddingV: 8 },
    xl: { container: 120, icon: 84, border: 4, fontSize: 24, paddingH: 24, paddingV: 12 },
  }

  const dim = dimensions[size]

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handlePress = useCallback(() => {
    if (!showTooltipOnPress) return

    // Clear any existing timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    setShowTooltip(true)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start()

    timeoutRef.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowTooltip(false))
    }, 2000)
  }, [showTooltipOnPress, fadeAnim])

  if (variant === 'pill') {
    return (
      <View
        style={[
          styles.pillContainer,
          {
            borderColor: color,
            borderWidth: dim.border,
            backgroundColor: color + '15',
            paddingHorizontal: dim.paddingH,
            paddingVertical: dim.paddingV,
          },
          style,
        ]}
      >
        <Text
          style={[
            styles.pillText,
            {
              color: color,
              fontSize: dim.fontSize,
            },
          ]}
        >
          {level}
        </Text>
      </View>
    )
  }

  const badge = iconOnly ? (
    <Image
      source={require('../assets/images/bicep-icon.png')}
      style={[
        {
          width: dim.icon,
          height: dim.icon,
          tintColor: color,
        },
        style as any,
      ]}
      resizeMode="contain"
    />
  ) : (
    <View
      style={[
        styles.container,
        {
          width: dim.container,
          height: dim.container,
        },
        style,
      ]}
    >
      <Svg
        height={dim.container}
        width={dim.container}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop
              offset="1"
              stopColor={lightenColor(color, 40)}
              stopOpacity="1"
            />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={dim.container / 2}
          cy={dim.container / 2}
          r={(dim.container - dim.border) / 2}
          stroke="url(#grad)"
          strokeWidth={dim.border}
          fill={color + '15'}
        />
      </Svg>
      <Image
        source={require('../assets/images/bicep-icon.png')}
        style={{
          width: dim.icon,
          height: dim.icon,
          tintColor: color,
        }}
        resizeMode="contain"
      />
    </View>
  )

  if (!showTooltipOnPress) {
    return badge
  }

  // Calculate approximate tooltip width for centering
  const tooltipWidth = level.length * (dim.fontSize * 0.6) + 20
  const tooltipOffset = (tooltipWidth - dim.container) / 2

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.wrapper}
    >
      {showTooltip && (
        <Animated.View
          style={[
            styles.tooltip,
            {
              backgroundColor: color,
              opacity: fadeAnim,
              left: -tooltipOffset,
              minWidth: tooltipWidth,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.tooltipText, { fontSize: dim.fontSize }]}>
            {level}
          </Text>
          <View style={[styles.tooltipArrow, { borderTopColor: color }]} />
        </Animated.View>
      )}
      {badge}
    </TouchableOpacity>
  )
}


const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillContainer: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
})

