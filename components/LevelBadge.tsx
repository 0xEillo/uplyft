import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native'

export type StrengthLevel =
  | 'Beginner'
  | 'Novice'
  | 'Intermediate'
  | 'Advanced'
  | 'Elite'
  | 'World Class'

const LEVEL_COLORS: Record<StrengthLevel, string> = {
  Beginner: '#9CA3AF',
  Novice: '#3B82F6',
  Intermediate: '#10B981',
  Advanced: '#8B5CF6',
  Elite: '#F59E0B',
  'World Class': '#EF4444',
}

interface LevelBadgeProps {
  level: StrengthLevel
  size?: 'small' | 'medium' | 'large'
  style?: ViewStyle
  showTooltipOnPress?: boolean
}

export function LevelBadge({
  level,
  size = 'medium',
  style,
  showTooltipOnPress = true,
}: LevelBadgeProps) {
  const color = LEVEL_COLORS[level]
  const [showTooltip, setShowTooltip] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const timeoutRef = useRef<NodeJS.Timeout>()

  const dimensions = {
    small: { container: 26, icon: 16, border: 2, fontSize: 10 },
    medium: { container: 34, icon: 20, border: 2.5, fontSize: 11 },
    large: { container: 48, icon: 28, border: 3, fontSize: 12 },
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

  const badge = (
    <View
      style={[
        styles.container,
        {
          width: dim.container,
          height: dim.container,
          borderRadius: dim.container / 2,
          borderWidth: dim.border,
          borderColor: color,
          backgroundColor: color + '15',
        },
        style,
      ]}
    >
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

export function getLevelColor(level: StrengthLevel): string {
  return LEVEL_COLORS[level]
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

