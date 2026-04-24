/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native'

const tintColorLight = '#FF6B35'
const tintColorDark = '#FF6B35'

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono:
      "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
})

/**
 * Design tokens. Prefer these over raw numbers in StyleSheet.
 *
 * Scales are derived from the most-used values already in the app
 * so existing code stays visually identical after token migration.
 */

/** Spacing scale (4px grid). Use for padding, margin, gap. */
export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const
export type SpacingKey = keyof typeof Spacing

/** Border radius scale. Use `pill` for fully-rounded (capsules, circles via width/2). */
export const Radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const
export type RadiusKey = keyof typeof Radius

/** Font size ramp. Maps to intent, not raw px. */
export const FontSize = {
  /** 11 — micro labels */
  xs: 11,
  /** 12 — badge text, chips, dense meta */
  tiny: 12,
  /** 13 — captions, section titles, secondary meta */
  sm: 13,
  /** 15 — secondary body */
  base: 15,
  /** 16 — primary body / list items */
  md: 16,
  /** 18 — emphasized body, header titles */
  lg: 18,
  /** 20 — subtitles */
  xl: 20,
  /** 24 — section headings, sheet titles */
  xxl: 24,
  /** 28 — screen titles */
  title: 28,
  /** 32 — display / hero */
  display: 32,
} as const
export type FontSizeKey = keyof typeof FontSize

/** Font weight ramp. Keep to these 5 — drop 400/900 over time. */
export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const
export type FontWeightKey = keyof typeof FontWeight

/** Line height multipliers to apply against FontSize. */
export const LineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.5,
} as const

/** Icon sizes. Matches the scattered 16/20/22/24 already in use. */
export const IconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 22,
  xl: 24,
  xxl: 28,
} as const
export type IconSizeKey = keyof typeof IconSize

/** Fixed layout primitives that can't live in Spacing. */
export const Layout = {
  /** Blurred navbar island height used across ~17 screens. */
  navbarHeight: 76,
  /** Compact navbar (e.g. search). */
  navbarHeightCompact: 52,
  /** Minimum touch target (Apple HIG). */
  tapTarget: 44,
  /** Circular icon button size — use with Radius.pill. */
  iconButton: 44,
  /** Standard hairline divider. */
  hairline: 1,
  /** Primary CTA row height. */
  buttonHeight: {
    sm: 36,
    md: 44,
    lg: 52,
  },
} as const

/** Shadow presets. RN needs shadow* (iOS) + elevation (Android). */
export const Shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const

/** Motion durations (ms). For Animated / LayoutAnimation. */
export const Duration = {
  instant: 100,
  fast: 150,
  base: 200,
  slow: 300,
  slower: 500,
} as const

/** Opacity presets (disabled states, overlays, press feedback). */
export const Opacity = {
  disabled: 0.4,
  muted: 0.6,
  pressed: 0.8,
  overlay: 0.5,
  scrim: 0.7,
} as const

/** Typography presets — use these instead of {fontSize,fontWeight,lineHeight} triples. */
export const Typography = {
  display: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    lineHeight: FontSize.display * LineHeight.tight,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.title * LineHeight.tight,
  },
  heading: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.xxl * LineHeight.tight,
  },
  subtitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.xl * LineHeight.normal,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.lg * LineHeight.normal,
  },
  bodyLarge: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.md * LineHeight.relaxed,
  },
  bodyLargeSemibold: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.md * LineHeight.relaxed,
  },
  body: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.base * LineHeight.relaxed,
  },
  bodySemibold: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.base * LineHeight.relaxed,
  },
  caption: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  captionBold: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  /** Uppercase section label (SETTINGS/GENERAL style). */
  overline: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.sm * LineHeight.normal,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  micro: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.xs * LineHeight.normal,
  },
} as const
export type TypographyKey = keyof typeof Typography

/** One bundled export if you prefer `Theme.spacing.md` style. */
export const Theme = {
  spacing: Spacing,
  radius: Radius,
  fontSize: FontSize,
  fontWeight: FontWeight,
  lineHeight: LineHeight,
  iconSize: IconSize,
  layout: Layout,
  shadow: Shadow,
  duration: Duration,
  opacity: Opacity,
  typography: Typography,
} as const
