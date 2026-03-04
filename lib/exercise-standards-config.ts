/**
 * Central Exercise Standards Configuration
 * Single source of truth for exercises that have strength standards and percentile tracking
 */

import { SECONDARY_EXERCISE_MUSCLE_MAPPING } from './exercise-standards-config-secondary'

export type StrengthLevel =
  | 'Untrained'
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
  id: string
  name: string
  aliases?: string[]
  gifUrl?: string | null
  male: StrengthStandard[]
  female: StrengthStandard[]
  tier?: 1 | 2
  isRepBased?: boolean
}

/** Weight applied to tier-2 exercises in strength score calculations (tier-1 = 1.0) */
export const TIER2_WEIGHT = 0.45

/**
 * Canonical list of exercises with strength standards
 * These exercises have standards defined and support percentile rankings (used in workout chat)
 */
export const EXERCISES_WITH_STANDARDS: ExerciseStandardsConfig[] = [
  // Bench Press
  {
    id: 'a1a9f5cd-1e9f-47b1-b7cd-162d2de80ddb',
    name: 'Bench Press (Barbell)',
    tier: 1,
    gifUrl: 'EIeI8Vf.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        color: '#64748B',
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
    id: 'd5b6efa3-2ebe-4eec-9e59-7a2b5ad4aa12',
    name: 'Incline Bench Press (Barbell)',
    tier: 1,
    gifUrl: '3TZduzM.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        color: '#64748B',
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

  // Decline Bench Press
  {
    id: 'd06c7a2e-f5dd-49e4-a63f-f659d94cded5',
    name: 'Decline Bench Press (Barbell)',
    aliases: ['Barbell Decline Bench Press'],
    tier: 1,
    gifUrl: 'GrO65fd.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        multiplier: 2.25,
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
        multiplier: 0.25,
        color: '#64748B',
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
        multiplier: 1.25,
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

  // Dumbbell Bench Press
  {
    id: '7927cf04-6d4b-4f01-9cd2-441ad398f214',
    name: 'Bench Press (Dumbbell)',
    tier: 1,
    gifUrl: 'SpYC0Kp.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#64748B',
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
        color: '#64748B',
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
    id: 'f0d9f5c0-0da6-493b-a7d5-64cf793dbdca',
    name: 'Incline Bench Press (Dumbbell)',
    tier: 1,
    gifUrl: 'ns0SIbU.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#64748B',
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
        color: '#64748B',
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

  // Chest Press
  {
    id: 'd6328434-8f90-40eb-8f27-5cf26033e65d',
    name: 'Chest Press (Machine)',
    aliases: ['Chest Press'],
    tier: 2,
    gifUrl: 'T0yTjgW.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        multiplier: 2.25,
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
        multiplier: 0.15,
        color: '#64748B',
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
        multiplier: 0.55,
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
  },

  // Squat
  {
    id: 'ec791278-a90a-446a-a853-94e68646416b',
    name: 'Squat (Barbell)',
    tier: 1,
    gifUrl: 'qXTaZnJ.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.75,
        color: '#64748B',
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
        color: '#64748B',
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
    id: '50c3ce34-9b80-4f8b-92c4-365183476959',
    name: 'Front Squat (Barbell)',
    tier: 1,
    gifUrl: 'zG0zs85.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.6,
        color: '#64748B',
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
        color: '#64748B',
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
    id: 'cbd8a5d7-e51a-4691-8731-65d4dab19db2',
    name: 'Deadlift (Barbell)',
    tier: 1,
    gifUrl: 'GUT8I22.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 1.0,
        color: '#64748B',
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
        color: '#64748B',
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
    id: 'c216a0a7-c3a6-458b-b691-a5c6afca0662',
    name: 'Romanian Deadlift (Barbell)',
    tier: 1,
    gifUrl: 'wQ2c4XD.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.75,
        color: '#64748B',
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
        color: '#64748B',
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

  // Overhead Press / Shoulder Press
  {
    id: 'baf05047-e528-47da-adf2-9be58d124278',
    name: 'Shoulder Press (Barbell)',
    tier: 1,
    gifUrl: 'wdRZISl.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.35,
        color: '#64748B',
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
        color: '#64748B',
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

  // Machine Shoulder Press
  {
    id: '25050a20-cd9d-4193-b681-dd7c1af27348',
    name: 'Shoulder Press (Machine)',
    tier: 2,
    gifUrl: 'CggQhII.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#64748B',
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
        multiplier: 0.1,
        color: '#64748B',
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
        multiplier: 0.85,
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
        multiplier: 1.55,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Dumbbell Shoulder Press
  {
    id: '674beec1-ce86-401d-980d-8ae5949ec707',
    name: 'Seated Shoulder Press (Dumbbell)',
    tier: 1,
    gifUrl: 'znQUdHY.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#64748B',
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
        color: '#64748B',
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
    id: 'f87f37bd-dfb9-4f88-a178-82423ab0e6a0',
    name: 'Bent Over Row (Barbell)',
    tier: 1,
    gifUrl: 'SzX3uzM.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        color: '#64748B',
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
    id: '62de3610-8941-4c87-aff2-31d5da85f82f',
    name: 'Lat Pulldown (Cable)',
    tier: 2,
    gifUrl: 'eYnzaCm.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        color: '#64748B',
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
    id: '8416f9f6-5500-4412-9cbe-e779f0314511',
    name: 'Weighted Pull-Up',
    aliases: ['Weighted Pull Up', 'Weighted Pull-Ups', 'Weighted Pullups'],
    tier: 1,
    gifUrl: 'HMzLjXx.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.0,
        color: '#64748B',
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
        color: '#64748B',
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

  // Weighted Dip (multiplier represents added weight as fraction of bodyweight)
  {
    id: 'f18faaa7-0cb5-4d5f-9474-a1f822c4ed84',
    name: 'Weighted Dip',
    tier: 1,
    gifUrl: 'MU9HnE7.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.0,
        color: '#64748B',
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
        color: '#64748B',
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
    id: '66076631-fbf3-4240-9358-99563893ff90',
    name: 'Bicep Curl (Dumbbell)',
    tier: 1,
    gifUrl: 'NbVPDMW.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#64748B',
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
        color: '#64748B',
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

  // Hammer Curl (Dumbbell)
  {
    id: '82081200-5fb6-4bf4-9341-d2f4b96ecfb6',
    name: 'Hammer Curl (Dumbbell)',
    tier: 2,
    gifUrl: 'slDvUAU.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#64748B',
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
    female: [
      {
        level: 'Beginner',
        multiplier: 0.05,
        color: '#64748B',
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
        multiplier: 0.2,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.3,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.4,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.5,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Incline Hammer Curl (Dumbbell)
  {
    id: '5505819c-2e69-4889-b883-afdf8b20e3e2',
    name: 'Incline Hammer Curl (Dumbbell)',
    aliases: ['Dumbbell Incline Hammer Curl'],
    tier: 2,
    gifUrl: 'ByX0WxV.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#64748B',
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
        multiplier: 0.4,
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
        multiplier: 0.75,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.05,
        color: '#64748B',
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
        multiplier: 0.3,
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
    id: '715479a2-4676-4ae1-a94e-b469d7c387e0',
    name: 'Bicep Curl (Barbell)',
    tier: 1,
    gifUrl: 'Yza7XrQ.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#64748B',
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
        color: '#64748B',
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
    id: 'f270f1b1-4769-4fa0-babb-39dfa1296dcd',
    name: 'Leg Press (Machine)',
    tier: 2,
    gifUrl: '10Z2DXU.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 1.0,
        color: '#64748B',
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
        color: '#64748B',
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
    id: 'f709f0a1-f934-4b25-8b30-115035bf53a3',
    name: 'Bulgarian Split Squat (Dumbbell)',
    tier: 1,
    gifUrl: 'qx4fgX7.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#64748B',
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
        color: '#64748B',
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
    id: '67d8950c-2c29-44f8-8cdc-43d238b1a9f2',
    name: 'Hip Thrust (Barbell)',
    aliases: ['Hip Thrust (Barbell)', 'Barbell Hip Thrust'],
    tier: 1,
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        color: '#64748B',
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
    id: 'ff36b318-02d7-4750-aff3-322046ecb190',
    name: 'Dumbbell Row (Dumbbell)',
    tier: 1,
    gifUrl: 'C0MA9bC.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#64748B',
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
        color: '#64748B',
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

  // Seated Row (Cable)
  {
    id: '0ecd527a-c4ee-476c-9c02-293bfd4f7c46',
    name: 'Seated Row (Cable)',
    tier: 2,
    gifUrl: 'Tq6gbK6.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        color: '#64748B',
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
    id: '4f70d4fe-7eee-4c95-9da7-1c35a78de5c2',
    name: 'Close Grip Bench Press (Barbell)',
    tier: 1,
    gifUrl: 'J6Dx1Mu.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        color: '#64748B',
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
    id: '37b7c704-b4c1-4745-8ae7-e2cbd9432508',
    name: 'Pushdown (Cable)',
    tier: 2,
    gifUrl: '3ZflifB.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#64748B',
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
        color: '#64748B',
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

  // Rope Pushdown
  {
    id: '591af367-e71d-4ad5-9754-1c3f39a9b434',
    name: 'Rope Pushdown (Cable)',
    aliases: ['Cable Pushdown (Rope)', 'Rope Pushdown', 'Tricep Rope Pushdown'],
    tier: 2,
    gifUrl: 'dU605di.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#64748B',
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
        multiplier: 0.6,
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
        multiplier: 0.1,
        color: '#64748B',
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
        multiplier: 0.85,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.05,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Standing Calf Raise
  {
    id: '51f08b8b-34d3-4e8b-bf9d-5d28c071c4ae',
    name: 'Standing Calf Raise (Machine)',
    tier: 2,
    gifUrl: 'ykUOVze.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        multiplier: 1.1,
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
        color: '#64748B',
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
        multiplier: 0.8,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.1,
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
        multiplier: 1.9,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },
  // Machine Shrug
  {
    id: 'de0aeeaa-8bd0-4c4b-8602-986025dfdc17',
    name: 'Shrug (Machine)',
    aliases: ['Shrug', 'Machine Shrug'],
    tier: 2,
    gifUrl: 'ZZKbeMw.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.6,
        color: '#64748B',
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
        multiplier: 2.6,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 3.2,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.4,
        color: '#64748B',
        description: 'Just starting out',
      },
      {
        level: 'Novice',
        multiplier: 0.7,
        color: '#3B82F6',
        description: 'A few months training',
      },
      {
        level: 'Intermediate',
        multiplier: 1.1,
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
  },
  // Dumbbell Shrug
  {
    id: '0c92879c-8d2f-47e5-a998-94e079786c7e',
    name: 'Shrug (Dumbbell)',
    aliases: ['DB Shrug', 'Dumbbell Shrugs', 'Dumbbell Shrug'],
    tier: 2,
    gifUrl: 'NJzBsGJ.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#64748B',
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
        multiplier: 0.6,
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
    female: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#64748B',
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
        multiplier: 0.65,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.95,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.2,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },
  // Hanging Leg Raise
  {
    id: '00fbaaa6-b29b-4e7c-982e-78978d2f1d3d',
    name: 'Hanging Leg Raise',
    tier: 2,
    isRepBased: true,
    gifUrl: 'I3tsCnC.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0,
        color: '#64748B',
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
        multiplier: 18,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 34,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 52,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 70,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0,
        color: '#64748B',
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
        multiplier: 15,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 28,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 43,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 55,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },
  // Back Extension
  {
    id: '4502ba9e-c0bc-4ab4-8a8f-9773f64479c8',
    name: 'Back Extension (Machine)',
    tier: 2,
    gifUrl: 'rUXfn3R.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.05,
        color: '#64748B',
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
        multiplier: 0.6,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.9,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.2,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.02,
        color: '#64748B',
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
  // Hyperextension
  {
    id: '15cba386-ed64-4c01-afc3-bb64e82d22a9',
    name: 'Hyperextension',
    aliases: ['Hyperextension (Bodyweight)', 'Hyper Extension'],
    tier: 2,
    gifUrl: 'zhMwOwE.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#64748B',
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
        multiplier: 0.5,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.7,
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
        multiplier: 0.12,
        color: '#64748B',
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
  // Leg Extension
  {
    id: '0f69ada8-ed3f-446d-a837-221c501ca826',
    name: 'Leg Extension (Machine)',
    tier: 2,
    gifUrl: 'my33uHU.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#64748B',
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
        multiplier: 0.8,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.1,
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
        multiplier: 1.9,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#64748B',
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
        multiplier: 1.1,
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
  },
  // Rope Face Pulls
  {
    id: '9bc822c6-6f3d-45bb-b5fa-994c29eaa5ac',
    name: 'Rope Face Pulls (Cable)',
    tier: 2,
    gifUrl: 'ZfyAGhK.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#64748B',
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
        color: '#64748B',
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
        multiplier: 0.4,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.55,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.7,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },
  // Lateral Raise
  {
    id: 'a97d866b-b29e-4b25-914a-ada0d59be96b',
    name: 'Seated Lateral Raise (Dumbbell)',
    tier: 1,
    gifUrl: 'hxyTtWj.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.05,
        color: '#64748B',
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
        multiplier: 0.15,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.25,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.35,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.45,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.02,
        color: '#64748B',
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
        multiplier: 0.1,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.15,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.22,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.3,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },
  // Wrist Curl
  {
    id: 'ce77ea3f-772d-435c-b1ca-05b1e9d6c6fe',
    name: 'Wrist Curl (Barbell)',
    tier: 2,
    gifUrl: '82LxxkW.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#64748B',
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
        multiplier: 1.1,
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
        color: '#64748B',
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
        multiplier: 0.55,
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
  // Cable Hammer Curl
  {
    id: 'aaa729ff-5681-4241-bda4-dd848afab3ef',
    name: 'Rope Hammer Curl (Cable)',
    tier: 2,
    gifUrl: 'HPlPoQA.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#64748B',
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
    female: [
      {
        level: 'Beginner',
        multiplier: 0.08,
        color: '#64748B',
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
        multiplier: 0.4,
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
        multiplier: 1.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },
  // Leg Curl
  {
    id: '97ab3978-17bf-4c48-ae37-1683355e694c',
    name: 'Seated Leg Curl (Machine)',
    tier: 2,
    gifUrl: 'Zg3XY7P.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#64748B',
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
        multiplier: 1.45,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#64748B',
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
  },
  // Calf Raise
  {
    id: '41571546-3273-4913-b1c8-4717088c8f44',
    name: 'Seated Calf Raise (Machine)',
    tier: 2,
    gifUrl: 'bOOdeyc.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.3,
        color: '#64748B',
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
        multiplier: 0.8,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 1.2,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 1.6,
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
        color: '#64748B',
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
        multiplier: 0.8,
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
        multiplier: 1.4,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },
  // Triceps Extension
  {
    id: '5de336b5-00af-4b0a-b2e9-79a2b11d6b28',
    name: 'Triceps Extension (Machine)',
    tier: 2,
    gifUrl: 'Ser9eQp.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#64748B',
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
        multiplier: 0.08,
        color: '#64748B',
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
        multiplier: 0.4,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.55,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.7,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },
  // Lying Leg Curl
  {
    id: 'cdd2929b-ccc0-4d9f-bea4-6b47d08dca64',
    name: 'Lying Leg Curl (Machine)',
    tier: 2,
    gifUrl: '17lJ1kr.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#64748B',
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
        multiplier: 1.25,
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
        multiplier: 2.15,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#64748B',
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
        multiplier: 1.45,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Hack Squat (Machine)
  {
    id: '4075e4c0-aeb6-460d-9de7-98064e5fde4c',
    name: 'Hack Squat (Machine)',
    aliases: ['Hack Squat', 'Sled Hack Squat', 'Machine Hack Squat'],
    tier: 2,
    gifUrl: 'Qa55kX1.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.75,
        color: '#64748B',
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
        multiplier: 2.75,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 4.0,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 5.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#64748B',
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
        multiplier: 3.25,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 4.0,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Lateral Raise (Dumbbell)
  {
    id: '49f4eca5-609a-4c85-a482-57a5db72bd33',
    name: 'Lateral Raise (Dumbbell)',
    aliases: [
      'Lateral Raise',
      'Dumbbell Lateral Raise',
      'Side Raise',
      'Side Lateral Raise',
    ],
    tier: 1,
    gifUrl: 'DsgkuIt.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.05,
        color: '#64748B',
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
        multiplier: 0.3,
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
    female: [
      {
        level: 'Beginner',
        multiplier: 0.05,
        color: '#64748B',
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
        multiplier: 0.15,
        color: '#10B981',
        description: '1-2 years consistent training',
      },
      {
        level: 'Advanced',
        multiplier: 0.2,
        color: '#8B5CF6',
        description: '2-5 years dedicated training',
      },
      {
        level: 'Elite',
        multiplier: 0.3,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 0.4,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // T Bar Row (Machine)
  {
    id: '10d290b0-ada9-44f9-b52f-dfe13e224bd3',
    name: 'T Bar Row (Machine)',
    aliases: ['T Bar Row', 'T-Bar Row'],
    tier: 2,
    gifUrl: 'aaXr7ld.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.5,
        color: '#64748B',
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
        multiplier: 0.25,
        color: '#64748B',
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
        multiplier: 1.45,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.85,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
  },

  // Preacher Curl (Barbell)
  {
    id: 'e47e46c4-4e66-4b6d-b808-074c922428bb',
    name: 'Preacher Curl (Barbell)',
    aliases: ['Preacher Curl', 'Barbell Preacher Curl', 'EZ Bar Preacher Curl'],
    tier: 1,
    gifUrl: 'qOgPVf6.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.2,
        color: '#64748B',
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
        multiplier: 1.1,
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
        multiplier: 0.1,
        color: '#64748B',
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

  // Overhead Cable Extension (Cable) - Cable Overhead Tricep Extension
  {
    id: '67f335db-9176-491f-ad48-bf8c3f8cec4b',
    name: 'Overhead Cable Extension (Cable)',
    aliases: [
      'Cable Overhead Tricep Extension',
      'Cable High Pulley Overhead Tricep Extension',
      'Overhead Cable Extension',
    ],
    tier: 2,
    gifUrl: '1xHyxys.gif',
    male: [
      {
        level: 'Beginner',
        multiplier: 0.15,
        color: '#64748B',
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
        multiplier: 0.55,
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
        multiplier: 1.25,
        color: '#F59E0B',
        description: 'Competitive athlete level',
      },
      {
        level: 'World Class',
        multiplier: 1.55,
        color: '#EF4444',
        description: 'World record territory',
      },
    ],
    female: [
      {
        level: 'Beginner',
        multiplier: 0.1,
        color: '#64748B',
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

  // Cable Crunch
  {
    id: 'f59ce0f6-5118-421e-9010-0074247c9d9f',
    name: 'Cable Crunch (Cable)',
    aliases: ['Cable Crunch', 'Kneeling Cable Crunch', 'Cable Crunches'],
    tier: 2,
    gifUrl: null,
    male: [
      {
        level: 'Beginner',
        multiplier: 0.25,
        color: '#64748B',
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
        multiplier: 2.25,
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
        multiplier: 0.25,
        color: '#64748B',
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
        multiplier: 2.25,
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
  },
]

/**
 * Get list of exercise names (including aliases) that support percentile rankings
 */
export function getLeaderboardExercises(): string[] {
  const names: string[] = []
  EXERCISES_WITH_STANDARDS.forEach((config) => {
    names.push(config.name)
    if (config.aliases) {
      names.push(...config.aliases)
    }
  })
  return names
}

export function isRepBasedExercise(exerciseName: string): boolean {
  const config = getExerciseNameMap().get(exerciseName)
  return config?.isRepBased ?? false
}

export type ExerciseGroup = 'Push' | 'Pull' | 'Lower' | 'Other'

/**
 * Maps trackable exercise names to their primary muscle group for granular display
 */
export const EXERCISE_MUSCLE_MAPPING: Record<string, string> = {
  // Chest
  'Bench Press (Barbell)': 'Chest',
  'Incline Bench Press (Barbell)': 'Chest',
  'Decline Bench Press (Barbell)': 'Chest',
  'Bench Press (Dumbbell)': 'Chest',
  'Incline Bench Press (Dumbbell)': 'Chest',
  'Chest Press (Machine)': 'Chest',
  'Chest Press': 'Chest',
  'Barbell Decline Bench Press': 'Chest',

  // Shoulders
  'Shoulder Press (Barbell)': 'Shoulders',
  'Shoulder Press (Machine)': 'Shoulders',
  'Seated Shoulder Press (Dumbbell)': 'Shoulders',
  'Seated Lateral Raise (Dumbbell)': 'Shoulders',
  'Lateral Raise (Dumbbell)': 'Shoulders',
  'Rope Face Pulls (Cable)': 'Shoulders',

  // Back
  'Bent Over Row (Barbell)': 'Back',
  'Lat Pulldown (Cable)': 'Back',
  'Weighted Pull-Up': 'Back',
  'Weighted Pull Up': 'Back',
  'Deadlift (Barbell)': 'Lower Back',
  'Bent Over Row (Dumbbell)': 'Back',
  'Seated Row': 'Back',
  'Seated Row (Machine)': 'Back',
  'T Bar Row (Machine)': 'Back',

  // Traps
  'Shrug (Machine)': 'Traps',
  'Shrug (Dumbbell)': 'Traps',

  // Biceps
  'Bicep Curl (Dumbbell)': 'Biceps',
  'Hammer Curl (Dumbbell)': 'Biceps',
  'Incline Hammer Curl (Dumbbell)': 'Biceps',
  'Bicep Curl (Barbell)': 'Biceps',
  'Rope Hammer Curl (Cable)': 'Biceps',
  'Preacher Curl (Barbell)': 'Biceps',

  // Triceps
  'Weighted Dip': 'Triceps',
  'Close Grip Bench Press (Barbell)': 'Triceps',
  'Pushdown (Cable)': 'Triceps',
  'Rope Pushdown (Cable)': 'Triceps',
  'Triceps Extension (Machine)': 'Triceps',
  'Overhead Cable Extension (Cable)': 'Triceps',

  // Quads
  'Squat (Barbell)': 'Quads',
  'Front Squat (Barbell)': 'Quads',
  'Leg Press (Machine)': 'Quads',
  'Bulgarian Split Squat (Dumbbell)': 'Quads',
  'Leg Extension (Machine)': 'Quads',
  'Hack Squat (Machine)': 'Quads',

  // Hamstrings
  'Romanian Deadlift (Barbell)': 'Hamstrings',
  'Seated Leg Curl (Machine)': 'Hamstrings',
  'Lying Leg Curl (Machine)': 'Hamstrings',

  // Glutes
  'Hip Thrust (Barbell)': 'Glutes',
  'Barbell Hip Thrust': 'Glutes',

  // Calves
  'Standing Calf Raise (Machine)': 'Calves',
  'Seated Calf Raise (Machine)': 'Calves',

  // Core
  'Hanging Leg Raise': 'Core',
  'Cable Crunch (Cable)': 'Core',

  // Lower Back
  'Back Extension (Machine)': 'Lower Back',
  Hyperextension: 'Lower Back',
  'Hyperextension (Bodyweight)': 'Lower Back',
  'Hyper Extension': 'Lower Back',

  // Forearms
  'Wrist Curl (Barbell)': 'Forearms',
}

/**
 * Maps trackable exercises back to high-level groups
 */
const EXERCISE_GROUPS: Record<string, ExerciseGroup> = {
  'Bench Press (Barbell)': 'Push',
  'Incline Bench Press (Barbell)': 'Push',
  'Decline Bench Press (Barbell)': 'Push',
  'Bench Press (Dumbbell)': 'Push',
  'Incline Bench Press (Dumbbell)': 'Push',
  'Chest Press (Machine)': 'Push',
  'Chest Press': 'Push',
  'Barbell Decline Bench Press': 'Push',
  'Shoulder Press (Barbell)': 'Push',
  'Shoulder Press (Machine)': 'Push',
  'Seated Shoulder Press (Dumbbell)': 'Push',
  'Weighted Dip': 'Push',

  'Close Grip Bench Press (Barbell)': 'Push',
  'Pushdown (Cable)': 'Push',
  'Rope Pushdown (Cable)': 'Push',
  'Seated Lateral Raise (Dumbbell)': 'Push',
  'Triceps Extension (Machine)': 'Push',

  'Bent Over Row (Barbell)': 'Pull',
  'Lat Pulldown (Cable)': 'Pull',
  'Weighted Pull-Up': 'Pull',
  'Bicep Curl (Dumbbell)': 'Pull',
  'Hammer Curl (Dumbbell)': 'Pull',
  'Incline Hammer Curl (Dumbbell)': 'Pull',
  'Bicep Curl (Barbell)': 'Pull',
  'Bent Over Row (Dumbbell)': 'Pull',
  'Seated Row': 'Pull',
  'Seated Row (Machine)': 'Pull',
  'Rope Face Pulls (Cable)': 'Pull',
  'Shrug (Machine)': 'Pull',
  'Shrug (Dumbbell)': 'Pull',
  'Rope Hammer Curl (Cable)': 'Pull',
  'Wrist Curl (Barbell)': 'Pull',

  'Squat (Barbell)': 'Lower',
  'Front Squat (Barbell)': 'Lower',
  'Deadlift (Barbell)': 'Lower',
  'Romanian Deadlift (Barbell)': 'Lower',
  'Leg Press (Machine)': 'Lower',
  'Bulgarian Split Squat (Dumbbell)': 'Lower',
  'Hip Thrust (Barbell)': 'Lower',
  'Barbell Hip Thrust': 'Lower',
  'Leg Extension (Machine)': 'Lower',
  'Standing Calf Raise (Machine)': 'Lower',
  'Back Extension (Machine)': 'Lower',
  Hyperextension: 'Lower',
  'Hyperextension (Bodyweight)': 'Lower',
  'Hyper Extension': 'Lower',
  'Seated Leg Curl (Machine)': 'Lower',
  'Lying Leg Curl (Machine)': 'Lower',
  'Seated Calf Raise (Machine)': 'Lower',
}

/**
 * Get all exercises that count towards a specific muscle's level
 */
export function getTrackableExercisesForMuscle(
  muscleName: string,
): ExerciseStandardsConfig[] {
  const primaryExerciseNames = Object.entries(EXERCISE_MUSCLE_MAPPING)
    .filter(([_, muscle]) => muscle === muscleName)
    .map(([exercise, _]) => exercise)

  const secondaryExerciseNames = Object.entries(
    SECONDARY_EXERCISE_MUSCLE_MAPPING,
  )
    .filter(([_, muscle]) => muscle === muscleName)
    .map(([exercise, _]) => exercise)

  const allExerciseNames = Array.from(
    new Set([...primaryExerciseNames, ...secondaryExerciseNames]),
  )

  return EXERCISES_WITH_STANDARDS.filter((ex) =>
    allExerciseNames.includes(ex.name),
  )
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
    if (config.aliases) {
      for (const alias of config.aliases) {
        map.set(alias, config)
      }
    }
  }

  return map
}
