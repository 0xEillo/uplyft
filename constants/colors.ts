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
  text: '#1a1a1a',
  textSecondary: '#666',
  textTertiary: '#999',
  textLight: '#bbb',
  textPlaceholder: '#ccc',

  // Background colors
  background: '#fafafa',
  backgroundWhite: '#fff',
  backgroundLight: '#f0f0f0',
  inputBackground: '#fafafa',
  feedCardBackground: '#fff',

  // Border colors
  border: '#f0f0f0',

  // Shadow colors
  shadow: '#000',

  // Status colors
  success: '#4CAF50',
  error: '#f44336',
  warning: '#FF9800',
  info: '#2196F3',
  buttonText: '#fff',

  // Specific UI colors
  icon: '#687076',
  link: '#007AFF',
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
  background: '#141414', // Main background - dark but not black
  backgroundWhite: '#242424', // Card background - slightly elevated
  backgroundLight: '#2C2C2C', // Input backgrounds - more elevated
  inputBackground: '#2C2C2C', // Explicit input background
  feedCardBackground: '#1c1c1c', // Feed card background - slightly lighter than main background

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
} as const

export function getColors(isDark: boolean) {
  return isDark ? darkColors : lightColors
}

// Default export for backwards compatibility
export const AppColors = lightColors

export type AppColorKey = keyof typeof lightColors
