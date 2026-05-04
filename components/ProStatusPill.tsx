/**
 * Pro status pill for the navbar — same liquid-glass capsule treatment as
 * other navbar islands (streak / actions).
 *
 * Non-Pro: filled brand capsule + white label (upgrade CTA). Pro: clear glass
 * + brand text only (manage subscription).
 */

import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { Paywall } from '@/components/paywall'
import { Layout } from '@/constants/theme'
import { useSubscription } from '@/contexts/subscription-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useFeatureGate } from '@/utils/analytics-helpers'
import { useState } from 'react'
import { Linking, Platform, StyleSheet, Text, TouchableOpacity } from 'react-native'

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'
const GOOGLE_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions'

export function ProStatusPill() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { isProMember, customerInfo } = useSubscription()
  const { trackPaywallShown, trackPaywallDismissed } = useFeatureGate()
  const [paywallVisible, setPaywallVisible] = useState(false)

  const handlePress = async () => {
    if (isProMember) {
      const url =
        customerInfo?.managementURL ||
        (Platform.OS === 'ios'
          ? APPLE_SUBSCRIPTIONS_URL
          : GOOGLE_SUBSCRIPTIONS_URL)
      try {
        await Linking.openURL(url)
      } catch {
        // No-op; managementURL is best-effort.
      }
      return
    }
    trackPaywallShown('upgrade_cta', 'home_navbar')
    setPaywallVisible(true)
  }

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <LiquidGlassSurface
          isInteractive
          glassEffectStyle="regular"
          tintColor={isProMember ? undefined : colors.brandPrimary}
          style={[styles.glassCapsule, !isProMember && styles.glassCapsuleCta]}
          fallbackStyle={
            isProMember
              ? {
                  borderWidth: StyleSheet.hairlineWidth * 2,
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(0,0,0,0.1)',
                }
              : { backgroundColor: colors.brandPrimary }
          }
        >
          <Text
            style={[
              styles.proLabel,
              { color: isProMember ? colors.brandPrimary : '#fff' },
            ]}
          >
            {isProMember ? 'PRO' : 'TRY PRO'}
          </Text>
        </LiquidGlassSurface>
      </TouchableOpacity>
      <Paywall
        visible={paywallVisible}
        onClose={() => {
          trackPaywallDismissed('upgrade_cta', 'home_navbar')
          setPaywallVisible(false)
        }}
        feature="upgrade_cta"
      />
    </>
  )
}

/** Same footprint as `actionsIsland` / `circleActionIsland` on home (44×44, r=22). */
const ISLAND = Layout.iconButton
const ISLAND_RADIUS = ISLAND / 2

const styles = StyleSheet.create({
  glassCapsule: {
    height: ISLAND,
    minHeight: ISLAND,
    borderRadius: ISLAND_RADIUS,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
  },
  glassCapsuleCta: {
    minWidth: 90,
    paddingHorizontal: 10,
  },
  proLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    lineHeight: 14,
  },
})
