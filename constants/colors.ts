/**
 * Color constants used throughout the app
 * Supports both light and dark themes
 */

const lightColors = {
  // Brand colors
  primary: '#FF6B35',
  primaryDark: '#ff4444',
  primaryLight: '#FFF5F0',

  // Neutral colors
  white: '#fff',
  black: '#000',
  text: '#000',
  textSecondary: '#3a3a3c',
  textTertiary: '#8e8e93',
  textLight: '#aeaeb2',
  textPlaceholder: '#c7c7cc',

  // Background colors
  background: '#ffffff', // Standard social media white
  backgroundWhite: '#ffffff',
  backgroundLight: '#F0F0F5', // Slightly lighter accent (between Gray 5 and 6)
  inputBackground: '#F0F0F5', // Slightly lighter accent
  feedCardBackground: '#ffffff',
  feedCardSeparator: '#E1E1E6', // Slightly lighter separator

  // Border colors
  border: '#E1E1E6', // Slightly lighter border

  // Shadow colors
  shadow: '#000',

  // Status colors
  success: '#34c759',
  error: '#ff3b30',
  warning: '#ff9500',
  info: '#007aff',
  buttonText: '#fff',

  // Specific UI colors
  icon: '#8e8e93',
  link: '#007aff',
  exerciseRowTint: 'rgba(0,0,0,0.02)', // Subtle tint for exercise rows
} as const

const darkColors = {
  // Brand colors (keep vibrant in dark mode)
  primary: '#FF6B35',
  primaryDark: '#ff4444',
  primaryLight: '#2C2018', // Darker version for dark mode

  // Neutral colors (subtle dark theme like Cal AI)
  white: '#242424', // Dark gray for cards/surfaces, not pure black
  black: '#fff', // Inverted
  text: '#F5F5F5', // Slightly off-white for better readability
  textSecondary: '#A8A8A8',
  textTertiary: '#888888',
  textLight: '#6B6B6B',
  textPlaceholder: '#555555',

  // Background colors (layered depth)
  background: '#000000', // Deep black for standard dark mode
  backgroundWhite: '#242424', // Card background - slightly elevated
  backgroundLight: '#2C2C2C', // Input backgrounds - more elevated
  inputBackground: '#2C2C2C', // Explicit input background
  feedCardBackground: '#0a0a0a', // Feed card background - only slightly lighter than exerciseRowTint
  feedCardSeparator: '#1C1C1C', // Lighter gray separator between feed cards

  // Border colors (very subtle)
  border: '#333333',

  // Shadow colors
  shadow: '#000',

  // Status colors (slightly adjusted for dark mode)
  success: '#5FD068',
  error: '#FF5252',
  warning: '#FFB74D',
  info: '#42A5F5',
  buttonText: '#fff',

  // Specific UI colors
  icon: '#A8A8A8',
  link: '#0A84FF', // Brighter blue for dark mode
  exerciseRowTint: 'rgba(255,255,255,0.03)', // Subtle tint for exercise rows
} as const

export function getColors(isDark: boolean) {
  return isDark ? darkColors : lightColors
}

// Default export for backwards compatibility
export const AppColors = lightColors

export type AppColorKey = keyof typeof lightColors
