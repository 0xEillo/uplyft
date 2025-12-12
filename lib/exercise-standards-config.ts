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
  aliases: string[] // Alternative names that map to this exercise
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
    aliases: ['Bench Press'],
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
    aliases: ['Incline Bench Press'],
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
    aliases: [],
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
    aliases: ['Incline Dumbbell Press', 'Dumbbell Incline Press'],
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
    aliases: ['Squat', 'Barbell Full Squat', 'Back Squat'],
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
    aliases: ['Front Squat'],
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
    aliases: ['Deadlift', 'Conventional Deadlift'],
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
    aliases: ['Romanian Deadlift', 'RDL', 'Dumbbell Romanian Deadlift'],
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
    aliases: ['Overhead Press', 'Barbell Shoulder Press', 'Military Press', 'OHP'],
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
    aliases: ['Dumbbell Shoulder Press', 'Seated Dumbbell Press', 'DB Shoulder Press'],
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
    aliases: ['Barbell Row', 'Barbell Rows', 'Bent Over Row', 'BB Row'],
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
    aliases: ['Lat Pulldown', 'Pulldown'],
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

  // Pull-ups (bodyweight exercise - standards are in absolute reps, not multipliers)
  {
    name: 'Pull-Up',
    aliases: [],
    male: [
      {
        level: 'Beginner',
        multiplier: 1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 5,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 10,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 15,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 20,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 25,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 3,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 6,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 10,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 15,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 20,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Weighted Pull-Ups (multiplier represents added weight as fraction of bodyweight)
  {
    name: 'Weighted Pull-Up',
    aliases: ['Weighted Pull-Ups'],
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

  // Dips
  {
    name: 'Chest Dip',
    aliases: ['Dips', 'Triceps Dip', 'Parallel Bar Dip'],
    male: [
      {
        level: 'Beginner',
        multiplier: 1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 8,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 15,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 25,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 35,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 45,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 1,
        color: '#9CA3AF',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 5,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 10,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 15,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 20,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 30,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Weighted Dips (multiplier represents added weight as fraction of bodyweight)
  {
    name: 'Weighted Tricep Dips',
    aliases: ['Weighted Dips'],
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
    aliases: ['Dumbbell Curl', 'Dumbbell Biceps Curl', 'DB Curl'],
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
    aliases: [],
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
    aliases: [],
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
    aliases: ['Bulgarian Split Squat', 'DB Bulgarian Split Squat'],
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
    aliases: ['Barbell Hip Thrust'],
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
    aliases: ['Dumbbell Row', 'DB Row', 'One Arm Dumbbell Row'],
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
    aliases: ['Seated Cable Row', 'Cable Row'],
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
    aliases: ['Close-Grip Bench Press', 'CGBP'],
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
    aliases: ['Tricep Pushdown', 'Cable Tricep Pushdown', 'Triceps Pushdown'],
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
]

/**
 * Get list of exercise names that support percentile rankings
 */
export function getLeaderboardExercises(): string[] {
  return EXERCISES_WITH_STANDARDS.flatMap((config) => [
    config.name,
    ...config.aliases,
  ])
}

export type ExerciseGroup = 'Upper Push' | 'Upper Pull' | 'Lower' | 'Other'

const EXERCISE_GROUPS: Record<string, ExerciseGroup> = {
  'Barbell Bench Press': 'Upper Push',
  'Barbell Incline Bench Press': 'Upper Push',
  'Dumbbell Bench Press': 'Upper Push',
  'Dumbbell Incline Bench Press': 'Upper Push',
  'Barbell Seated Overhead Press': 'Upper Push',
  'Dumbbell Seated Shoulder Press': 'Upper Push',
  'Chest Dip': 'Upper Push',
  'Weighted Tricep Dips': 'Upper Push',

  'Barbell Bent Over Row': 'Upper Pull',
  'Cable Pulldown': 'Upper Pull',
  'Pull-Up': 'Upper Pull',
  'Weighted Pull-Up': 'Upper Pull',
  'Dumbbell Standing Biceps Curl': 'Upper Pull',
  'Barbell Curl': 'Upper Pull',
  'Dumbbell One Arm Bent-Over Row': 'Upper Pull',
  'Cable Seated Row': 'Upper Pull',

  'Barbell Squat': 'Lower',
  'Barbell Front Squat': 'Lower',
  'Barbell Deadlift': 'Lower',
  'Barbell Romanian Deadlift': 'Lower',
  'Leg Press': 'Lower',
  'Dumbbell Bulgarian Split Squat': 'Lower',
  'Hip Thrust': 'Lower',

  'Close Grip Bench Press': 'Upper Push',
  'Cable Pushdown': 'Upper Push',
}

/**
 * Get the muscle group category for an exercise
 */
export function getExerciseGroup(exerciseName: string): ExerciseGroup {
  // Check direct match first
  if (exerciseName in EXERCISE_GROUPS) {
    return EXERCISE_GROUPS[exerciseName]
  }

  // Check aliases by resolving to main name
  const map = getExerciseNameMap()
  const config = map.get(exerciseName)
  if (config && config.name in EXERCISE_GROUPS) {
    return EXERCISE_GROUPS[config.name]
  }

  return 'Other'
}

/**
 * Create a map from exercise name (including aliases) to the main exercise config
 */
export function getExerciseNameMap(): Map<string, ExerciseStandardsConfig> {
  const map = new Map<string, ExerciseStandardsConfig>()

  for (const config of EXERCISES_WITH_STANDARDS) {
    // Add main name
    map.set(config.name, config)

    // Add all aliases
    for (const alias of config.aliases) {
      map.set(alias, config)
    }
  }

  return map
}
