import { WorkoutSessionWithDetails, WorkoutExerciseWithDetails } from '@/types/database.types';

export interface WorkoutStats {
  totalVolume: number; // in kg
  totalSets: number;
  totalReps: number;
  duration: number; // in minutes
  exerciseCount: number;
  prCount: number;
  topWeight: number;
  uniqueMuscleGroups: string[];
}

export interface AnimalComparison {
  name: string;
  multiplier: number;
  emoji: string;
  description: string;
}

const ANIMAL_COMPARISONS: AnimalComparison[] = [
  { name: 'House Cat', multiplier: 0.05, emoji: '🐱', description: 'Just getting started!' },
  { name: 'Fox', multiplier: 0.15, emoji: '🦊', description: 'Quick and agile' },
  { name: 'Wolf', multiplier: 0.3, emoji: '🐺', description: 'Pack leader material' },
  { name: 'Jaguar', multiplier: 0.5, emoji: '🐆', description: 'Apex predator vibes' },
  { name: 'Grizzly Bear', multiplier: 0.75, emoji: '🐻', description: 'Pure raw power' },
  { name: 'Silverback Gorilla', multiplier: 1.0, emoji: '🦍', description: 'Primate strength!' },
  { name: 'African Elephant', multiplier: 1.5, emoji: '🐘', description: 'Massive power!' },
  { name: 'Great White Shark', multiplier: 2.0, emoji: '🦈', description: 'Ocean destroyer' },
  { name: 'Tyrannosaurus Rex', multiplier: 3.0, emoji: '🦖', description: 'Prehistoric beast!' },
];

/**
 * Calculate total volume lifted in a workout (in kg)
 * Note: All weights are stored in kg internally, regardless of user's display preference.
 * The weightUnit parameter is only used for the calculation context and is not applied
 * to the stored weights. Use formatVolume() to convert the result for display.
 */
export function calculateTotalVolume(workout: WorkoutSessionWithDetails, weightUnit: 'kg' | 'lb' = 'kg'): number {
  if (!workout.workout_exercises) return 0;

  let totalVolume = 0;

  workout.workout_exercises.forEach((exercise) => {
    exercise.sets?.forEach((set) => {
      const weight = set.weight || 0; // Already in kg
      const reps = set.reps || 0;

      // Volume calculation: weight (kg) × reps
      totalVolume += weight * reps;
    });
  });

  return Math.round(totalVolume);
}

/**
 * Calculate workout statistics
 */
export function calculateWorkoutStats(
  workout: WorkoutSessionWithDetails,
  weightUnit: 'kg' | 'lb' = 'kg'
): WorkoutStats {
  const exercises = workout.workout_exercises || [];

  let totalSets = 0;
  let totalReps = 0;
  let prCount = 0;
  let topWeight = 0;
  const muscleGroups = new Set<string>();

  exercises.forEach((exercise) => {
    // Track muscle groups
    if (exercise.exercise?.muscle_group) {
      muscleGroups.add(exercise.exercise.muscle_group);
    }

    // Count sets and reps
    exercise.sets?.forEach((set) => {
      totalSets++;
      totalReps += set.reps || 0;

      // Track top weight
      const weight = set.weight || 0;
      const weightInKg = weightUnit === 'lb' ? weight * 0.453592 : weight;
      if (weightInKg > topWeight) {
        topWeight = weightInKg;
      }
    });

    // Count PRs (if exercise has PR info)
    if ((exercise.exercise as any)?.pr_info?.is_current_pr) {
      prCount++;
    }
  });

  const totalVolume = calculateTotalVolume(workout, weightUnit);

  // Estimate duration (if not tracked, estimate 3 mins per set + 2 mins warmup)
  const duration = Math.round((totalSets * 3 + 2));

  return {
    totalVolume,
    totalSets,
    totalReps,
    duration,
    exerciseCount: exercises.length,
    prCount,
    topWeight: Math.round(topWeight),
    uniqueMuscleGroups: Array.from(muscleGroups),
  };
}

/**
 * Get animal comparison based on volume lifted
 * Returns the closest animal to the volume multiplier
 */
export function getAnimalComparison(volumeKg: number): AnimalComparison & { multiplier: number } {
  // Average human bodyweight for comparison (70kg)
  const avgBodyweight = 70;
  const volumeMultiplier = volumeKg / avgBodyweight;

  // Find the closest animal comparison
  let closestAnimal = ANIMAL_COMPARISONS[0];
  let closestDiff = Math.abs(volumeMultiplier - closestAnimal.multiplier);

  for (const animal of ANIMAL_COMPARISONS) {
    const diff = Math.abs(volumeMultiplier - animal.multiplier);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestAnimal = animal;
    }
  }

  return {
    ...closestAnimal,
    multiplier: parseFloat(volumeMultiplier.toFixed(2)),
  };
}

/**
 * Format volume for display (handles kg/lb conversion)
 */
export function formatVolume(volumeKg: number, targetUnit: 'kg' | 'lb' = 'kg'): { value: number; unit: string } {
  if (targetUnit === 'lb') {
    return {
      value: Math.round(volumeKg * 2.20462),
      unit: 'lb',
    };
  }
  return {
    value: Math.round(volumeKg),
    unit: 'kg',
  };
}

/**
 * Format duration in minutes to readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Calculate workout count for the current week
 */
export function getWorkoutCountThisWeek(workouts: WorkoutSessionWithDetails[]): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  return workouts.filter((workout) => {
    const workoutDate = new Date(workout.date);
    return workoutDate >= startOfWeek;
  }).length;
}
