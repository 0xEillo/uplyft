/**
 * Pro-tease primitives for freemium gating.
 *
 * Single visual language used for every locked thing in the app:
 *   `•••  🔒`  in a muted neutral tint.
 *
 * Why this design:
 * - The dots stand in for the hidden value (numbers/text the user can't see).
 * - The lock confirms it's gated.
 * - Muted tint stays out of the way; doesn't compete with content colors.
 * - Same element, different sizes — inline (replaces a value) or block
 *   (replaces a section's content). The surrounding context (a section
 *   header above, or the row a value sits in) tells the user *what* is
 *   locked; this element just says "it's locked, tap to unlock."
 *
 * Analytics: every press fires PAYWALL_SHOWN with the typed `feature` so the
 * gating funnel is consistent and granular by source.
 *
 * - <ProTease/>     replaces an inline value (a number, percentage, etc.)
 * - <ProUpsellCard/> replaces a whole section's content
 * - <ProGate/>      tap-anywhere wrapper if you need to gate arbitrary children
 */

import { Paywall } from '@/components/paywall'
import {
  PAYWALL_FEATURE_LABELS,
  type PaywallFeature,
} from '@/constants/analytics-events'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useFeatureGate } from '@/utils/analytics-helpers'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useState } from 'react'
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native'

const SIZE_SPEC = {
  xs: { font: 11, lock: 10, gap: 4 },
  sm: { font: 13, lock: 12, gap: 4 },
  md: { font: 16, lock: 14, gap: 6 },
  lg: { font: 24, lock: 22, gap: 8 },
} as const

type ProSize = keyof typeof SIZE_SPEC

interface GateProps {
  feature: PaywallFeature
  /** Override the source screen for analytics. Defaults to the feature name. */
  source?: string
}

/**
 * Centralizes paywall-open behavior for all gating primitives:
 * - Tracks PAYWALL_SHOWN with the typed feature
 * - Tracks PAYWALL_DISMISSED on close
 * - Returns the title to render in the paywall
 */
function usePaywallControls({ feature, source }: GateProps) {
  const [visible, setVisible] = useState(false)
  const { trackPaywallShown, trackPaywallDismissed } = useFeatureGate()

  const open = useCallback(() => {
    trackPaywallShown(feature, source ?? feature)
    setVisible(true)
  }, [feature, source, trackPaywallShown])

  const close = useCallback(() => {
    trackPaywallDismissed(feature, source ?? feature)
    setVisible(false)
  }, [feature, source, trackPaywallDismissed])

  const label = PAYWALL_FEATURE_LABELS[feature]
  const title =
    label === 'Pro' ? 'Unlock with Pro' : `${label} is part of Pro`

  return { visible, open, close, title }
}

/**
 * Tap-anywhere wrapper that opens the paywall. Use when gating a group of
 * elements behind a single touch target without changing their look.
 */
export function ProGate({
  children,
  style,
  feature,
  source,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
} & GateProps) {
  const { visible, open, close, title } = usePaywallControls({ feature, source })
  return (
    <>
      <TouchableOpacity activeOpacity={0.7} onPress={open} style={style}>
        {children}
      </TouchableOpacity>
      <Paywall
        visible={visible}
        onClose={close}
        title={title}
        feature={feature}
      />
    </>
  )
}

/**
 * Inline gated indicator. Drop-in replacement for any gated value.
 *
 *   {isProMember
 *     ? <Text>{Math.round(score)}</Text>
 *     : <ProTease size="md" feature="strength_score" />}
 */
export function ProTease({
  size = 'sm',
  tappable = true,
  feature,
  source,
}: {
  size?: ProSize
  /** If false, parent is responsible for paywall (e.g., wrapped in ProGate). */
  tappable?: boolean
} & GateProps) {
  return (
    <LockedDots
      size={size}
      tappable={tappable}
      feature={feature}
      source={source}
    />
  )
}

/**
 * Drop-in replacement for a section's *content* (not its header). Renders a
 * card-shaped body that mirrors the standard surface card (radius 16, soft
 * shadow, no border) and centers a larger `••• 🔒` inside.
 */
export function ProUpsellCard({
  feature,
  source,
  style,
}: {
  style?: StyleProp<ViewStyle>
} & GateProps) {
  const colors = useThemedColors()
  const { visible, open, close, title } = usePaywallControls({ feature, source })

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={open}
        style={[
          styles.upsellCard,
          { backgroundColor: colors.surfaceCard, shadowColor: '#000' },
          style,
        ]}
      >
        <LockedDotsInner size="lg" />
      </TouchableOpacity>
      <Paywall
        visible={visible}
        onClose={close}
        title={title}
        feature={feature}
      />
    </>
  )
}

/**
 * The atomic locked indicator: dots + lock. All gated UI in the app renders
 * this — never roll your own lock icon.
 */
function LockedDots({
  size,
  tappable,
  feature,
  source,
}: {
  size: ProSize
  tappable: boolean
} & GateProps) {
  const { visible, open, close, title } = usePaywallControls({ feature, source })
  const inner = <LockedDotsInner size={size} />

  if (!tappable) return inner

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={open}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {inner}
      </TouchableOpacity>
      <Paywall
        visible={visible}
        onClose={close}
        title={title}
        feature={feature}
      />
    </>
  )
}

function LockedDotsInner({ size }: { size: ProSize }) {
  const colors = useThemedColors()
  const spec = SIZE_SPEC[size]
  const tint = colors.textTertiary
  return (
    <View style={[styles.row, { gap: spec.gap }]}>
      <Text
        style={{
          fontSize: spec.font,
          lineHeight: spec.font * 1.05,
          fontWeight: '700',
          color: tint,
          letterSpacing: 1.5,
        }}
      >
        •••
      </Text>
      <Ionicons name="lock-closed" size={spec.lock} color={tint} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upsellCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
})
