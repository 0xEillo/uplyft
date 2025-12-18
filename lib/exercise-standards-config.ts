/**
 * Central Exercise Standards Configuration
 * Single source of truth for exercises that have strength standards and percentile tracking
 */

export type StrengthLevel =
  | 'Beginner'
  | 'Novice'
  | 'Intermediate'
  | 'Advanced'
  | 'Elite'
  | 'World Class'

export interface StrengthStandard {
  level: StrengthLevel
  multiplier: number // Bodyweight multiplier (e.g., 1.5 = 1.5x bodyweight)
  color: string
  description: string
}

export interface ExerciseStandardsConfig {
  name: string
  male: StrengthStandard[]
  female: StrengthStandard[]
}

/**
 * Canonical list of exercises with strength standards
 * These exercises have standards defined and support percentile rankings (used in workout chat)
 */
export const EXERCISES_WITH_STANDARDS: ExerciseStandardsConfig[] = [
  // Bench Press
  {
    name: 'Barbell Bench Press',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.0,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.3,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.5,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.65,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.9,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.1,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.25,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Incline Bench Press
  {
    name: 'Barbell Incline Bench Press',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.0,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.4,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.65,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.0,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.4,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.75,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Dumbbell Bench Press
  {
    name: 'Dumbbell Bench Press',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.35,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.5,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.75,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.0,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.25,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.2,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.3,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.7,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.9,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Incline Dumbbell Press
  {
    name: 'Dumbbell Incline Bench Press',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.35,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.5,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.65,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.85,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.2,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.3,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.45,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.6,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.75,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Squat
  {
    name: 'Barbell Squat',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.75,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 1.0,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.5,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 2.0,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 2.5,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.75,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.0,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Front Squat
  {
    name: 'Barbell Front Squat',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.6,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.85,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.25,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.75,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 2.0,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.25,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.4,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.6,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.85,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.25,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.5,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.75,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Deadlift
  {
    name: 'Barbell Deadlift',
    male: [
      {
        level: 'Beginner',
        multiplier: 1.0,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 1.25,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.75,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 2.25,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 2.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 3.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.25,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.75,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 2.0,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.25,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Romanian Deadlift
  {
    name: 'Barbell Romanian Deadlift',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.75,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 1.0,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.5,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 2.0,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 2.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 3.25,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.0,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Overhead Press
  {
    name: 'Barbell Seated Overhead Press',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.35,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.5,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.75,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.0,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.25,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.5,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.3,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.45,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.65,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.8,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Dumbbell Shoulder Press
  {
    name: 'Dumbbell Seated Shoulder Press',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.25,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.4,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.6,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.9,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.15,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.25,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.35,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.5,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.65,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Bent Over Row
  {
    name: 'Barbell Bent Over Row',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.0,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.4,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.65,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.9,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.2,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.5,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Lat Pulldown
  {
    name: 'Cable Pulldown',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.0,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.3,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.45,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.7,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.95,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.3,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.5,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Weighted Pull-Ups (multiplier represents added weight as fraction of bodyweight)
  {
    name: 'Weighted Pull Ups',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.0,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.1,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.25,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.75,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.0,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.05,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.15,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.35,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.5,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.65,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Weighted Dips (multiplier represents added weight as fraction of bodyweight)
  {
    name: 'Weighted Dips',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.0,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.15,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.35,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.65,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.0,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.35,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.0,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.1,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.25,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.45,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.7,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Dumbbell Curl
  {
    name: 'Dumbbell Standing Biceps Curl',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.15,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.3,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.65,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.8,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.05,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.1,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.2,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.35,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.45,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.55,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Barbell Curl
  {
    name: 'Barbell Curl',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.4,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.6,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.85,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.15,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.4,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.2,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.4,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.6,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.85,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.1,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Leg Press
  {
    name: 'Leg Press',
    male: [
      {
        level: 'Beginner',
        multiplier: 1.0,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 1.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 2.75,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 4.0,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 5.25,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 6.5,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 1.25,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 2.0,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 3.25,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 4.5,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 5.75,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Dumbbell Bulgarian Split Squat
  {
    name: 'Dumbbell Bulgarian Split Squat',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.25,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.4,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.6,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.8,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.2,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.3,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.45,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.6,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.75,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Hip Thrust
  {
    name: 'Hip Thrust',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 1.0,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.75,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 2.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 3.5,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 4.25,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 1.0,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.5,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 2.25,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 3.0,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 3.75,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Dumbbell Row
  {
    name: 'Dumbbell One Arm Bent-Over Row',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.35,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.55,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.8,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.05,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.3,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.2,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.35,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.65,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.8,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Seated Cable Row
  {
    name: 'Cable Seated Row',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.0,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 2.0,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.5,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.3,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.5,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.75,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.0,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.35,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.7,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Close Grip Bench Press
  {
    name: 'Close Grip Bench Press',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.75,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.25,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.5,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 2.0,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 2.4,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.3,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.5,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.75,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.05,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.35,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.6,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Tricep Pushdown
  {
    name: 'Cable Pushdown',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.5,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.75,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.0,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.5,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.8,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.25,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 0.5,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.75,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.05,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.3,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },
  // Standing Calf Raise
  {
    name: 'Standing Calf Raise',
    male: [
      { level: 'Beginner', multiplier: 0.5, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.75, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 1.1, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 1.5, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 2.0, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 2.5, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.3, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.5, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.8, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 1.1, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 1.5, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.9, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Barbell Shrug
  {
    name: 'Barbell Shrug',
    male: [
      { level: 'Beginner', multiplier: 0.6, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 1.0, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 1.5, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 2.0, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 2.6, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 3.2, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.4, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.7, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 1.1, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 1.5, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 2.0, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 2.5, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Hanging Leg Raise
  {
    name: 'Hanging Leg Raise',
    male: [
      { level: 'Beginner', multiplier: 0.05, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.15, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.3, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.5, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.7, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 0.9, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.02, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.1, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.2, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.35, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.5, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 0.7, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Back Extension
  {
    name: 'Back Extension',
    male: [
      { level: 'Beginner', multiplier: 0.05, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.15, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.35, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.6, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.9, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.2, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.02, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.1, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.25, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.45, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.7, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.0, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Leg Extension
  {
    name: 'Leg Extension',
    male: [
      { level: 'Beginner', multiplier: 0.25, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.5, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.8, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 1.1, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 1.5, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.9, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.15, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.35, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.55, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.8, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 1.1, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.4, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Face Pulls
  {
    name: 'Face Pulls',
    male: [
      { level: 'Beginner', multiplier: 0.15, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.25, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.4, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.6, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.8, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.0, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.1, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.15, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.25, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.4, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.55, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 0.7, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Lateral Raise
  {
    name: 'Dumbbell Seated Lateral Raise',
    male: [
      { level: 'Beginner', multiplier: 0.05, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.1, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.15, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.25, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.35, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 0.45, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.02, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.05, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.1, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.15, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.22, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 0.3, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Wrist Curl
  {
    name: 'Barbell Wrist Curl',
    male: [
      { level: 'Beginner', multiplier: 0.2, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.35, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.55, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.8, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 1.1, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.4, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.1, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.2, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.35, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.55, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.8, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.0, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Kettlebell Swing
  {
    name: 'Kettlebell Swing',
    male: [
      { level: 'Beginner', multiplier: 0.2, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.35, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.55, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.85, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 1.2, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.6, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.1, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.2, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.35, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.6, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.9, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.2, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Cable Hammer Curl
  {
    name: 'Cable Hammer Curl (Rope)',
    male: [
      { level: 'Beginner', multiplier: 0.15, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.25, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.4, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.6, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.85, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.1, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.08, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.15, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.25, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.4, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.6, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.0, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Leg Curl
  {
    name: 'Seated Leg Curl',
    male: [
      { level: 'Beginner', multiplier: 0.2, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.4, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.6, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.85, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 1.15, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.45, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.1, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.25, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.4, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.6, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.8, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.0, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Calf Raise
  {
    name: 'Seated Calf Raise',
    male: [
      { level: 'Beginner', multiplier: 0.3, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.5, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.8, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 1.2, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 1.6, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 2.0, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.2, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.35, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.5, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.8, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 1.1, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.4, color: '#EF4444', description: 'World record territory' },
    ],
  },
  // Triceps Extension
  {
    name: 'Triceps Extension',
    male: [
      { level: 'Beginner', multiplier: 0.15, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.25, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.4, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.6, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.8, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 1.0, color: '#EF4444', description: 'World record territory' },
    ],
    female: [
      { level: 'Beginner', multiplier: 0.08, color: '#9CA3AF', description: 'Just starting out' },
      { level: 'Novice', multiplier: 0.15, color: '#3B82F6', description: 'A few months training' },
      { level: 'Intermediate', multiplier: 0.25, color: '#10B981', description: '1-2 years consistent training' },
      { level: 'Advanced', multiplier: 0.4, color: '#8B5CF6', description: '2-5 years dedicated training' },
      { level: 'Elite', multiplier: 0.55, color: '#F59E0B', description: 'Competitive athlete level' },
      { level: 'World Class', multiplier: 0.7, color: '#EF4444', description: 'World record territory' },
    ],
  },
]

/**
 * Get list of exercise names that support percentile rankings
 */
export function getLeaderboardExercises(): string[] {
  return EXERCISES_WITH_STANDARDS.map((config) => config.name)
}

export type ExerciseGroup = 'Push' | 'Pull' | 'Lower' | 'Other'

/**
 * Maps trackable exercise names to their primary muscle group for granular display
 */
export const EXERCISE_MUSCLE_MAPPING: Record<string, string> = {
  // Chest
  'Barbell Bench Press': 'Chest',
  'Barbell Incline Bench Press': 'Chest',
  'Dumbbell Bench Press': 'Chest',
  'Dumbbell Incline Bench Press': 'Chest',
  'Weighted Dips': 'Chest',
  
  // Shoulders
  'Barbell Seated Overhead Press': 'Shoulders',
  'Dumbbell Seated Shoulder Press': 'Shoulders',
  'Dumbbell Seated Lateral Raise': 'Shoulders',
  'Face Pulls': 'Shoulders',
  
  // Back
  'Barbell Bent Over Row': 'Back',
  'Cable Pulldown': 'Back',
  'Weighted Pull Ups': 'Back',
  'Barbell Deadlift': 'Back',
  'Dumbbell One Arm Bent-Over Row': 'Back',
  'Cable Seated Row': 'Back',
  
  // Traps
  'Barbell Shrug': 'Traps',

  // Biceps
  'Dumbbell Standing Biceps Curl': 'Biceps',
  'Barbell Curl': 'Biceps',
  'Cable Hammer Curl (Rope)': 'Biceps',
  
  // Triceps
  'Close Grip Bench Press': 'Triceps',
  'Cable Pushdown': 'Triceps',
  'Triceps Extension': 'Triceps',
  
  // Quads
  'Barbell Squat': 'Quads',
  'Barbell Front Squat': 'Quads',
  'Leg Press': 'Quads',
  'Dumbbell Bulgarian Split Squat': 'Quads',
  'Leg Extension': 'Quads',
  
  // Hamstrings
  'Barbell Romanian Deadlift': 'Hamstrings',
  'Seated Leg Curl': 'Hamstrings',
  
  // Glutes
  'Hip Thrust': 'Glutes',
  'Kettlebell Swing': 'Glutes',
  
  // Calves
  'Standing Calf Raise': 'Calves',
  'Seated Calf Raise': 'Calves',
  
  // Abs
  'Hanging Leg Raise': 'Abs',
  
  // Lower Back
  'Back Extension': 'Lower Back',
  
  // Forearms
  'Barbell Wrist Curl': 'Forearms',
}

/**
 * Maps trackable exercises back to high-level groups
 */
const EXERCISE_GROUPS: Record<string, ExerciseGroup> = {
  'Barbell Bench Press': 'Push',
  'Barbell Incline Bench Press': 'Push',
  'Dumbbell Bench Press': 'Push',
  'Dumbbell Incline Bench Press': 'Push',
  'Barbell Seated Overhead Press': 'Push',
  'Dumbbell Seated Shoulder Press': 'Push',
  'Weighted Dips': 'Push',

  'Close Grip Bench Press': 'Push',
  'Cable Pushdown': 'Push',
  'Dumbbell Seated Lateral Raise': 'Push',
  'Triceps Extension': 'Push',

  'Barbell Bent Over Row': 'Pull',
  'Cable Pulldown': 'Pull',
  'Weighted Pull Ups': 'Pull',
  'Dumbbell Standing Biceps Curl': 'Pull',
  'Barbell Curl': 'Pull',
  'Dumbbell One Arm Bent-Over Row': 'Pull',
  'Cable Seated Row': 'Pull',
  'Face Pulls': 'Pull',
  'Barbell Shrug': 'Pull',
  'Cable Hammer Curl (Rope)': 'Pull',
  'Barbell Wrist Curl': 'Pull',

  'Barbell Squat': 'Lower',
  'Barbell Front Squat': 'Lower',
  'Barbell Deadlift': 'Lower',
  'Barbell Romanian Deadlift': 'Lower',
  'Leg Press': 'Lower',
  'Dumbbell Bulgarian Split Squat': 'Lower',
  'Hip Thrust': 'Lower',
  'Leg Extension': 'Lower',
  'Kettlebell Swing': 'Lower',
  'Standing Calf Raise': 'Lower',
  'Back Extension': 'Lower',
  'Seated Leg Curl': 'Lower',
  'Seated Calf Raise': 'Lower',
}

/**
 * Get all exercises that count towards a specific muscle's level
 */
export function getTrackableExercisesForMuscle(muscleName: string): string[] {
  return Object.entries(EXERCISE_MUSCLE_MAPPING)
    .filter(([_, muscle]) => muscle === muscleName)
    .map(([exercise, _]) => exercise)
}

/**
 * Get the movement group (Push/Pull/Lower) for an exercise
 */
export function getExerciseGroup(exerciseName: string): ExerciseGroup {
  if (exerciseName in EXERCISE_GROUPS) {
    return EXERCISE_GROUPS[exerciseName]
  }

  return 'Other'
}

/**
 * Create a map from exercise name (including aliases) to the main exercise config
 */
export function getExerciseNameMap(): Map<string, ExerciseStandardsConfig> {
  const map = new Map<string, ExerciseStandardsConfig>()

  for (const config of EXERCISES_WITH_STANDARDS) {
    map.set(config.name, config)
  }

  return map
}
