import { memo, useId } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'

interface AiOrbProps {
  size?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The AI chat's avatar: a soft, lit sphere. The top edge is crisp and warm
 * (cream highlight), shading down to slate blue, with the lower edge
 * dissolving into the background.
 */
export const AiOrb = memo(function AiOrb({ size = 40, style }: AiOrbProps) {
  // Gradient/mask ids must be unique per instance; useId's colons break url().
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const bodyId = `orb-body-${id}`
  const highlightId = `orb-highlight-${id}`
  const haloId = `orb-halo-${id}`
  const fadeId = `orb-fade-${id}`
  const fadeMaskId = `orb-fade-mask-${id}`
  const haloFadeId = `orb-halo-fade-${id}`
  const haloMaskId = `orb-halo-mask-${id}`

  return (
    <View
      style={[{ width: size, height: size }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* Main body: warm cream at the top shading to slate blue. */}
          <LinearGradient id={bodyId} x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#FDF7E0" />
            <Stop offset="0.22" stopColor="#E9E5D3" />
            <Stop offset="0.48" stopColor="#9DA8B3" />
            <Stop offset="0.75" stopColor="#6A7886" />
            <Stop offset="1" stopColor="#4E5B68" />
          </LinearGradient>

          {/* Soft specular glow near the top. */}
          <RadialGradient id={highlightId} cx="0.42" cy="0.1" r="0.45">
            <Stop offset="0" stopColor="#FFF8DE" stopOpacity="0.8" />
            <Stop offset="1" stopColor="#FFF8DE" stopOpacity="0" />
          </RadialGradient>

          {/* Fuzzy lower halo, slightly lighter at the rim. */}
          <RadialGradient id={haloId} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#56636F" stopOpacity="1" />
            <Stop offset="0.7" stopColor="#5E6B78" stopOpacity="0.9" />
            <Stop offset="0.86" stopColor="#7F8B97" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#7F8B97" stopOpacity="0" />
          </RadialGradient>

          {/* Crisp body fades out toward the bottom... */}
          <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.8" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
          <Mask id={fadeMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <Rect x="0" y="0" width="100" height="100" fill={`url(#${fadeId})`} />
          </Mask>

          {/* ...revealing the soft halo, which only shows on the lower half. */}
          <LinearGradient id={haloFadeId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="1" />
          </LinearGradient>
          <Mask id={haloMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <Rect x="0" y="0" width="100" height="100" fill={`url(#${haloFadeId})`} />
          </Mask>
        </Defs>

        <Circle
          cx="50"
          cy="50"
          r="46"
          fill={`url(#${haloId})`}
          mask={`url(#${haloMaskId})`}
        />
        <Circle
          cx="50"
          cy="46"
          r="42"
          fill={`url(#${bodyId})`}
          mask={`url(#${fadeMaskId})`}
        />
        <Circle
          cx="50"
          cy="46"
          r="42"
          fill={`url(#${highlightId})`}
          mask={`url(#${fadeMaskId})`}
        />
      </Svg>
    </View>
  )
})
