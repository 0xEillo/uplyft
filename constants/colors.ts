/**
 * Color constants used throughout the app
 */

export const AppColors = {
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

  // Border colors
  border: '#f0f0f0',

  // Shadow colors
  shadow: '#000',

  // Status colors
  success: '#4CAF50',
  error: '#f44336',
  warning: '#FF9800',
  info: '#2196F3',

  // Specific UI colors
  icon: '#687076',
  link: '#007AFF',
} as const

export type AppColorKey = keyof typeof AppColors
