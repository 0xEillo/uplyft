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

/**
 * Haptic sequence synchronized with a 1200ms progress bar fill.
 * Light taps → medium → heavy climax as the bar reaches 100%.
 */
export function hapticProgressBarFill(): void {
  if (Platform.OS !== 'ios') return

  const steps: Array<{ delay: number; style: Haptics.ImpactFeedbackStyle }> = [
    { delay: 0, style: Haptics.ImpactFeedbackStyle.Light },
    { delay: 150, style: Haptics.ImpactFeedbackStyle.Light },
    { delay: 320, style: Haptics.ImpactFeedbackStyle.Light },
    { delay: 520, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 720, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 920, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 1100, style: Haptics.ImpactFeedbackStyle.Heavy },
  ]

  for (const { delay, style } of steps) {
    setTimeout(() => Haptics.impactAsync(style), delay)
  }
}

/**
 * Shorter haptic sequence for an 800ms progress bar fill (e.g. new-level bar after level-up).
 */
export function hapticProgressBarFillShort(): void {
  if (Platform.OS !== 'ios') return

  const steps: Array<{ delay: number; style: Haptics.ImpactFeedbackStyle }> = [
    { delay: 0, style: Haptics.ImpactFeedbackStyle.Light },
    { delay: 200, style: Haptics.ImpactFeedbackStyle.Light },
    { delay: 420, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 620, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 760, style: Haptics.ImpactFeedbackStyle.Heavy },
  ]

  for (const { delay, style } of steps) {
    setTimeout(() => Haptics.impactAsync(style), delay)
  }
}

/**
 * Escalating haptic sequence for level-up moments.
 *
 * Mimics a progress bar filling up: rapid light taps → medium → heavy climax
 * when the rank badge and "RANK UP!" label fully animate in (~700ms).
 *
 * Timeline:
 *   0ms        light  (overlay fades in)
 *   130ms      light
 *   240ms      light  (tile springs in)
 *   380ms      medium
 *   490ms      medium
 *   590ms      medium
 *   690ms      heavy  (RANK UP! label appears)
 *   760ms      heavy  (final punch)
 */
export function hapticLevelUp(): void {
  if (Platform.OS !== 'ios') return

  const steps: Array<{ delay: number; style: Haptics.ImpactFeedbackStyle }> = [
    { delay: 0, style: Haptics.ImpactFeedbackStyle.Light },
    { delay: 130, style: Haptics.ImpactFeedbackStyle.Light },
    { delay: 240, style: Haptics.ImpactFeedbackStyle.Light },
    { delay: 380, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 490, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 590, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 690, style: Haptics.ImpactFeedbackStyle.Heavy },
    { delay: 760, style: Haptics.ImpactFeedbackStyle.Heavy },
  ]

  for (const { delay, style } of steps) {
    setTimeout(() => Haptics.impactAsync(style), delay)
  }
}
