/**
 * Color constants used throughout the app
 * Supports both light and dark themes
 */

const lightColors = {
  // Brand
  brandPrimary: '#FF6B35',
  brandPrimaryDark: '#ff4444',
  brandPrimarySoft: '#FFF5F0',

  // Text
  textPrimary: '#000',
  textSecondary: '#3a3a3c',
  textTertiary: '#8e8e93',
  textMuted: '#aeaeb2',
  textPlaceholder: '#c7c7cc',

  // Surfaces / background
  bg: '#F7F8F9', // Standard social media white
  surface: '#fff',
  surfaceSubtle: '#F0F0F5', // Slightly lighter accent (between Gray 5 and 6)
  surfaceInput: '#F0F0F5', // Input backgrounds
  surfaceCard: '#ffffff',
  surfaceSheet: '#ffffff',
  separator: '#E1E1E6', // Slightly lighter separator

  // Borders / shadow
  border: '#E1E1E6', // Slightly lighter border
  shadow: '#000',

  // Status
  statusSuccess: '#34c759',
  statusError: '#ff3b30',
  statusWarning: '#ff9500',
  statusInfo: '#007aff',
  onPrimary: '#fff',

  // Misc
  iconDefault: '#8e8e93',
  rowTint: 'rgba(0,0,0,0.02)', // Subtle tint for exercise rows
} as const

const darkColors = {
  // Brand
  brandPrimary: '#FF6B35',
  brandPrimaryDark: '#ff4444',
  brandPrimarySoft: '#2C2018', // Darker version for dark mode

  // Text
  textPrimary: '#F5F5F5', // Slightly off-white for better readability
  textSecondary: '#A8A8A8',
  textTertiary: '#888888',
  textMuted: '#6B6B6B',
  textPlaceholder: '#555555',

  // Surfaces / background
  bg: '#000000', // Deep black for standard dark mode
  surface: '#242424', // Dark gray for cards/surfaces, not pure black
  surfaceSubtle: '#2C2C2C', // Input backgrounds - more elevated
  surfaceInput: '#2C2C2C', // Explicit input background
  surfaceCard: '#111112', // Feed card background - only slightly lighter than rowTint
  surfaceSheet: '#111111', // Elevated background for sheets/modals
  separator: '#1C1C1C', // Lighter gray separator between feed cards

  // Borders / shadow
  border: '#333333',
  shadow: '#000',

  // Status
  statusSuccess: '#5FD068',
  statusError: '#FF5252',
  statusWarning: '#FFB74D',
  statusInfo: '#42A5F5',
  onPrimary: '#fff',

  // Misc
  iconDefault: '#A8A8A8',
  rowTint: 'rgba(255,255,255,0.03)', // Subtle tint for exercise rows
} as const

export function getColors(isDark: boolean) {
  return isDark ? darkColors : lightColors
}

// Default export for backwards compatibility
export const AppColors = lightColors

export type AppColorKey = keyof typeof lightColors
