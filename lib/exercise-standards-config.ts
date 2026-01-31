/**
 * Central Exercise Standards Configuration
 * Single source of truth for exercises that have strength standards and percentile tracking
 */

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
}

/**
 * Canonical list of exercises with strength standards
 * These exercises have standards defined and support percentile rankings (used in workout chat)
 */
export const EXERCISES_WITH_STANDARDS: ExerciseStandardsConfig[] = [
  // Bench Press
  {
    id: 'a1a9f5cd-1e9f-47b1-b7cd-162d2de80ddb',
    name: 'Bench Press (Barbell)',
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

  // Dumbbell Bench Press
  {
    id: '7927cf04-6d4b-4f01-9cd2-441ad398f214',
    name: 'Bench Press (Dumbbell)',
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

  // Squat
  {
    id: 'ec791278-a90a-446a-a853-94e68646416b',
    name: 'Squat (Barbell)',
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
    gifUrl: 'X3cqyXz.gif',
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

  // Barbell Curl
  {
    id: '715479a2-4676-4ae1-a94e-b469d7c387e0',
    name: 'Bicep Curl (Barbell)',
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
    gifUrl: 'SpYC0Kp.gif',
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
    id: '8e8ea45f-2a9e-47d5-8b99-410549aab166',
    name: 'Glute Bridge (Barbell)',
    gifUrl: 'qKBpF7I.gif',
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
    id: '288281a7-e9bc-4902-896e-1df4c892cd20',
    name: 'Bent Over Row (Dumbbell)',
    gifUrl: 'BJ0Hz5L.gif',
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

  // Seated Cable Row
  {
    id: '2bdfb2da-20f2-439d-8e4d-8b5e928a97ba',
    name: 'Seated Row',
    gifUrl: 'X3cqyXz.gif',
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
  // Standing Calf Raise
  {
    id: '51f08b8b-34d3-4e8b-bf9d-5d28c071c4ae',
    name: 'Standing Calf Raise (Machine)',
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
  // Barbell Shrug
  {
    id: 'de0aeeaa-8bd0-4c4b-8602-986025dfdc17',
    name: 'Shrug (Machine)',
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
  // Hanging Leg Raise
  {
    id: '00fbaaa6-b29b-4e7c-982e-78978d2f1d3d',
    name: 'Hanging Leg Raise',
    gifUrl: 'I3tsCnC.gif',
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
        multiplier: 0.5,
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
  // Back Extension
  {
    id: '4502ba9e-c0bc-4ab4-8a8f-9773f64479c8',
    name: 'Back Extension (Machine)',
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
  // Leg Extension
  {
    id: '0f69ada8-ed3f-446d-a837-221c501ca826',
    name: 'Leg Extension (Machine)',
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
  // Face Pulls
  {
    id: '595e8458-ceab-4608-955b-ebad4c02210d',
    name: 'Face Pull (Cable)',
    gifUrl: 'G61cXLk.gif',
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

export type ExerciseGroup = 'Push' | 'Pull' | 'Lower' | 'Other'

/**
 * Maps trackable exercise names to their primary muscle group for granular display
 */
export const EXERCISE_MUSCLE_MAPPING: Record<string, string> = {
  // Chest
  'Bench Press (Barbell)': 'Chest',
  'Incline Bench Press (Barbell)': 'Chest',
  'Bench Press (Dumbbell)': 'Chest',
  'Incline Bench Press (Dumbbell)': 'Chest',

  // Shoulders
  'Shoulder Press (Barbell)': 'Shoulders',
  'Shoulder Press (Machine)': 'Shoulders',
  'Seated Shoulder Press (Dumbbell)': 'Shoulders',
  'Seated Lateral Raise (Dumbbell)': 'Shoulders',
  'Face Pull (Cable)': 'Shoulders',

  // Back
  'Bent Over Row (Barbell)': 'Back',
  'Lat Pulldown (Cable)': 'Back',
  'Weighted Pull-Up': 'Back',
  'Weighted Pull Up': 'Back',
  'Deadlift (Barbell)': 'Back',
  'Bent Over Row (Dumbbell)': 'Back',
  'Seated Row (Machine)': 'Back',

  // Traps
  'Shrug (Machine)': 'Traps',

  // Biceps
  'Bicep Curl (Dumbbell)': 'Biceps',
  'Hammer Curl (Dumbbell)': 'Biceps',
  'Bicep Curl (Barbell)': 'Biceps',
  'Rope Hammer Curl (Cable)': 'Biceps',

  // Triceps
  'Weighted Dip': 'Triceps',
  'Close Grip Bench Press (Barbell)': 'Triceps',
  'Pushdown (Cable)': 'Triceps',
  'Triceps Extension (Machine)': 'Triceps',

  // Quads
  'Squat (Barbell)': 'Quads',
  'Front Squat (Barbell)': 'Quads',
  'Leg Press (Machine)': 'Quads',
  'Bulgarian Split Squat (Dumbbell)': 'Quads',
  'Leg Extension (Machine)': 'Quads',

  // Hamstrings
  'Romanian Deadlift (Barbell)': 'Hamstrings',
  'Seated Leg Curl (Machine)': 'Hamstrings',
  'Lying Leg Curl (Machine)': 'Hamstrings',

  // Glutes
  'Glute Bridge (Barbell)': 'Glutes',

  // Calves
  'Standing Calf Raise (Machine)': 'Calves',
  'Seated Calf Raise (Machine)': 'Calves',

  // Abs
  'Hanging Leg Raise': 'Abs',

  // Lower Back
  'Back Extension (Machine)': 'Lower Back',

  // Forearms
  'Wrist Curl (Barbell)': 'Forearms',
}

/**
 * Maps trackable exercises back to high-level groups
 */
const EXERCISE_GROUPS: Record<string, ExerciseGroup> = {
  'Bench Press (Barbell)': 'Push',
  'Incline Bench Press (Barbell)': 'Push',
  'Bench Press (Dumbbell)': 'Push',
  'Incline Bench Press (Dumbbell)': 'Push',
  'Shoulder Press (Barbell)': 'Push',
  'Shoulder Press (Machine)': 'Push',
  'Seated Shoulder Press (Dumbbell)': 'Push',
  'Weighted Dip': 'Push',

  'Close Grip Bench Press (Barbell)': 'Push',
  'Pushdown (Cable)': 'Push',
  'Seated Lateral Raise (Dumbbell)': 'Push',
  'Triceps Extension (Machine)': 'Push',

  'Bent Over Row (Barbell)': 'Pull',
  'Lat Pulldown (Cable)': 'Pull',
  'Weighted Pull-Up': 'Pull',
  'Bicep Curl (Dumbbell)': 'Pull',
  'Hammer Curl (Dumbbell)': 'Pull',
  'Bicep Curl (Barbell)': 'Pull',
  'Bent Over Row (Dumbbell)': 'Pull',
  'Seated Row (Machine)': 'Pull',
  'Face Pull (Cable)': 'Pull',
  'Shrug (Machine)': 'Pull',
  'Rope Hammer Curl (Cable)': 'Pull',
  'Wrist Curl (Barbell)': 'Pull',

  'Squat (Barbell)': 'Lower',
  'Front Squat (Barbell)': 'Lower',
  'Deadlift (Barbell)': 'Lower',
  'Romanian Deadlift (Barbell)': 'Lower',
  'Leg Press (Machine)': 'Lower',
  'Bulgarian Split Squat (Dumbbell)': 'Lower',
  'Glute Bridge (Barbell)': 'Lower',
  'Leg Extension (Machine)': 'Lower',
  'Standing Calf Raise (Machine)': 'Lower',
  'Back Extension (Machine)': 'Lower',
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
  const exerciseNames = Object.entries(EXERCISE_MUSCLE_MAPPING)
    .filter(([_, muscle]) => muscle === muscleName)
    .map(([exercise, _]) => exercise)

  return EXERCISES_WITH_STANDARDS.filter((ex) =>
    exerciseNames.includes(ex.name),
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
