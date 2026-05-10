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
 * - <ProTease/>         replaces an inline value (a number, percentage, etc.)
 * - <ProUnlockButton/>  consistent CTA placed UNDER a gated section's preview
 * - <ProUpsellCard/>    replaces a whole section's content with dots/lock
 * - <ProGate/>          tap-anywhere wrapper for arbitrary gated children
 */

import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { Paywall } from '@/components/paywall'
import {
  PAYWALL_FEATURE_LABELS,
  type PaywallFeature,
} from '@/constants/analytics-events'
import {
  EXERCISES_WITH_STANDARDS,
  type ExerciseStandardsConfig,
} from '@/lib/exercise-standards-config'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useFeatureGate } from '@/utils/analytics-helpers'
import { Ionicons } from '@expo/vector-icons'
import { useMemo, useCallback, useState, type ReactNode } from 'react'
import {
  ScrollView,
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
  const title = `Unlock ${label}`

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

function sortPreviewExercises(
  list: ExerciseStandardsConfig[],
): ExerciseStandardsConfig[] {
  return [...list].sort((a, b) => {
    const tierA = a.tier ?? 3
    const tierB = b.tier ?? 3
    if (tierA !== tierB) return tierA - tierB
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

function getCalcPreviewExerciseName(name: string): string {
  return name.replace(' (Barbell)', '')
}

/**
 * Read-only strip of lifts — used on the Progress paywall teaser so users see
 * what the Rank Calculator is before subscribing.
 */
export function RankCalculatorPaywallPreview() {
  const colors = useThemedColors()
  const exercises = useMemo(
    () => sortPreviewExercises(EXERCISES_WITH_STANDARDS).slice(0, 6),
    [],
  )

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rankPreviewScroll}
    >
      {exercises.map((ex) => (
        <View key={ex.id} style={styles.rankPreviewItem}>
          <ExerciseMediaThumbnail
            gifUrl={ex.gifUrl}
            style={styles.rankPreviewThumb}
          />
          <Text
            style={[styles.rankPreviewLabel, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {getCalcPreviewExerciseName(ex.name)}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

/**
 * Skeleton priority cards — when we have no recommendations yet, still show
 * what Priority Lifts looks like.
 */
export function PriorityLiftsPaywallPreview() {
  const colors = useThemedColors()
  return (
    <View style={styles.priorityPreviewRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.priorityPreviewCard,
            { backgroundColor: colors.bg },
          ]}
        >
          <View
            style={[
              styles.priorityPreviewThumb,
              { backgroundColor: colors.surfaceCard },
            ]}
          />
          <View
            style={[
              styles.priorityPreviewLine,
              { backgroundColor: colors.surfaceCard },
            ]}
          />
          <View
            style={[
              styles.priorityPreviewLineShort,
              { backgroundColor: colors.surfaceCard },
            ]}
          />
        </View>
      ))}
    </View>
  )
}

/**
 * Drop-in replacement for a section's *content* (not its header). Renders a
 * card-shaped body that mirrors the standard surface card (radius 16, soft
 * shadow, no border) and centers a larger `••• 🔒` inside.
 *
 * With optional `title` / `subtitle` / `children`, shows what the feature looks
 * like plus a lock footer instead of only dots.
 */
export function ProUpsellCard({
  feature,
  source,
  style,
  title,
  subtitle,
  children,
}: {
  style?: StyleProp<ViewStyle>
  title?: string
  subtitle?: string
  children?: ReactNode
} & GateProps) {
  const colors = useThemedColors()
  const { visible, open, close, title: paywallTitle } = usePaywallControls({
    feature,
    source,
  })
  const hasRichContent = Boolean(title || subtitle || children)

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={open}
        style={[
          styles.upsellCard,
          hasRichContent && styles.upsellCardRich,
          { backgroundColor: colors.surfaceCard, shadowColor: '#000' },
          style,
        ]}
      >
        {title ? (
          <Text style={[styles.upsellTitle, { color: colors.textPrimary }]}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            style={[styles.upsellSubtitle, { color: colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : null}
        {children ? (
          <View style={styles.upsellPreviewWrap}>{children}</View>
        ) : null}
        {hasRichContent ? (
          <View
            style={[
              styles.upsellLockFooter,
              { borderTopColor: colors.border },
            ]}
          >
            <Ionicons name="lock-closed" size={15} color={colors.brandPrimary} />
            <Text
              style={[styles.upsellLockFooterText, { color: colors.textSecondary }]}
            >
              Tap to unlock with Pro
            </Text>
          </View>
        ) : (
          <LockedDotsInner size="lg" />
        )}
      </TouchableOpacity>
      <Paywall
        visible={visible}
        onClose={close}
        title={paywallTitle}
        feature={feature}
      />
    </>
  )
}

/**
 * Standalone CTA button that sits underneath gated section content.
 *
 *   <ProUnlockButton feature="rank_calculator" source="strength_body" />
 *
 * Defaults its label to `Unlock <feature label>`; pass `label` to override
 * (e.g. "Unlock Strength Standards"). Brand-tinted, single visual language so
 * every gated section ends with the same ask.
 */
export function ProUnlockButton({
  feature,
  source,
  label,
  style,
}: {
  label?: string
  style?: StyleProp<ViewStyle>
} & GateProps) {
  const colors = useThemedColors()
  const { visible, open, close, title } = usePaywallControls({ feature, source })
  const buttonLabel = label ?? `Unlock ${PAYWALL_FEATURE_LABELS[feature]}`

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={open}
        style={[
          styles.unlockButton,
          { borderColor: colors.brandPrimary },
          style,
        ]}
      >
        <Ionicons name="star" size={18} color={colors.brandPrimary} />
        <Text
          style={[styles.unlockButtonText, { color: colors.brandPrimary }]}
          numberOfLines={1}
        >
          {buttonLabel}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.brandPrimary}
        />
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
  upsellCardRich: {
    alignItems: 'stretch',
    paddingVertical: 16,
    gap: 10,
  },
  upsellTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  upsellSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  upsellPreviewWrap: {
    marginTop: 2,
  },
  upsellLockFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  upsellLockFooterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rankPreviewScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  rankPreviewItem: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  rankPreviewThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  rankPreviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  priorityPreviewRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  priorityPreviewCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    gap: 8,
    maxWidth: 108,
  },
  priorityPreviewThumb: {
    height: 48,
    borderRadius: 12,
  },
  priorityPreviewLine: {
    height: 10,
    borderRadius: 5,
    width: '100%',
  },
  priorityPreviewLineShort: {
    height: 8,
    borderRadius: 4,
    width: '72%',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    marginTop: 12,
  },
  unlockButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
})
