import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

/**
 * Centralized haptic feedback utility for consistent, premium UX.
 * 
 * We use only 2 haptic strengths for a sleek, non-intrusive experience:
 * 
 * - `light`: Subtle feedback for minor interactions
 *   Use for: selections, toggles, tab switches, option picks, scrolling checkpoints
 * 
 * - `medium`: Noticeable feedback for significant actions  
 *   Use for: confirmations, successes, primary actions, important state changes
 * 
 * Note: Haptics are iOS-only. On Android, these are no-ops.
 */

export type HapticIntensity = 'light' | 'medium'

/**
 * Trigger a haptic feedback with the specified intensity.
 * 
 * @param intensity - 'light' for subtle interactions, 'medium' for important actions
 */
export function haptic(intensity: HapticIntensity = 'light'): void {
  // Skip haptics on Android for now (can be extended with vibration if needed)
  if (Platform.OS !== 'ios') return

  switch (intensity) {
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      break
    case 'medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      break
  }
}

/**
 * Async version of haptic for use in async functions.
 * Returns a promise that resolves when the haptic is triggered.
 */
export async function hapticAsync(intensity: HapticIntensity = 'light'): Promise<void> {
  if (Platform.OS !== 'ios') return

  switch (intensity) {
    case 'light':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      break
    case 'medium':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      break
  }
}

/**
 * Trigger a success notification haptic.
 * Use sparingly for major accomplishments (workout complete, goal achieved).
 * This uses the medium intensity under the hood but with notification style.
 */
export async function hapticSuccess(): Promise<void> {
  if (Platform.OS !== 'ios') return
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}

/**
 * Trigger an error notification haptic.
 * Use for error states and failed actions.
 */
export async function hapticError(): Promise<void> {
  if (Platform.OS !== 'ios') return
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
}
