import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Linking } from 'react-native';

// AsyncStorage keys
const HAS_RATED_KEY = '@has_rated_app';
const LAST_PROMPT_WORKOUT_COUNT_KEY = '@rating_prompt_last_shown_workout_count';

/**
 * Check if the user has already rated the app
 */
export async function hasUserRated(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(HAS_RATED_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking if user has rated:', error);
    return false;
  }
}

/**
 * Mark that the user has rated the app
 */
export async function markUserAsRated(): Promise<void> {
  try {
    await AsyncStorage.setItem(HAS_RATED_KEY, 'true');
  } catch (error) {
    console.error('Error marking user as rated:', error);
  }
}

/**
 * Get the workout count when the rating prompt was last shown
 */
export async function getLastPromptWorkoutCount(): Promise<number | null> {
  try {
    const value = await AsyncStorage.getItem(LAST_PROMPT_WORKOUT_COUNT_KEY);
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    console.error('Error getting last prompt workout count:', error);
    return null;
  }
}

/**
 * Save the workout count when the rating prompt was shown
 */
export async function savePromptWorkoutCount(count: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_PROMPT_WORKOUT_COUNT_KEY, count.toString());
  } catch (error) {
    console.error('Error saving prompt workout count:', error);
  }
}

/**
 * Determine if we should show the rating prompt based on workout count
 * Rules:
 * - Show after first workout
 * - If dismissed, show again after user has 10+ more workouts
 * - Never show if user has already rated
 */
export async function shouldShowRatingPrompt(currentWorkoutCount: number): Promise<boolean> {
  // Don't show if user already rated
  const hasRated = await hasUserRated();
  if (hasRated) {
    return false;
  }

  // Show after first workout
  if (currentWorkoutCount === 1) {
    return true;
  }

  // Check if we should show again (after 10 more workouts)
  const lastPromptCount = await getLastPromptWorkoutCount();
  if (lastPromptCount === null) {
    // Never shown before and not first workout
    return false;
  }

  // Show if they've done 10 or more workouts since last prompt
  return currentWorkoutCount >= lastPromptCount + 10;
}

/**
 * Open the native store review dialog
 */
export async function requestReview(): Promise<void> {
  try {
    const isAvailable = await StoreReview.isAvailableAsync();

    if (isAvailable) {
      await StoreReview.requestReview();
      return;
    }

    // Fallback: open the store page if native review isn't available
    const url = await StoreReview.storeUrl();
    if (url) {
      // Open the App Store/Play Store directly
      await Linking.openURL(url);
      await markUserAsRated();
    }
  } catch (error) {
    console.error('Error requesting review:', error);
  }
}
