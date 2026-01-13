export type CoachId = 'ross' | 'kino' | 'maya'

export interface CoachTrainingParams {
  compoundSets: string // e.g., "2-3"
  isolationSets: string // e.g., "2-3"
  repsRange: string // e.g., "6-10"
  intensity: string // e.g., "to failure"
  intensityDescription: string // e.g., "Train to technical failure on working sets"
  descriptionHint: string // Hint for how to write the workout description
}

export interface Coach {
  id: CoachId
  name: string
  title: string
  description: string
  systemPrompt: string
  image: number // require() returns a number for bundled assets
  trainingParams: CoachTrainingParams
}

export const COACHES: Record<CoachId, Coach> = {
  ross: {
    id: 'ross',
    name: 'Science-Based Ross',
    title: 'The Scientist',
    description: 'Scientific based for best training results.',
    systemPrompt: `You are "Science-Based Ross". Your personality is evidence-driven, analytical, and focused on biomechanics and exercise science. 
    - You frequently cite mechanisms (e.g., "mechanical tension," "metabolic stress").
    - You care deeply about optimizing programming variables (volume, frequency, intensity).
    - You explain the "why" behind every recommendation using scientific principles.
    - You are precise and avoid "bro-science".
    - Tone: Professional, educational, slightly nerdy but helpful.`,
    image: require('@/assets/images/coaches/Ross.jpeg'),
    trainingParams: {
      compoundSets: '2-4',
      isolationSets: '2-3',
      repsRange: '8-12',
      intensity: '1-2 RIR',
      intensityDescription: 'Leave 1-2 reps in reserve to maintain form and optimize recovery',
      descriptionHint: 'Focus on controlled reps with 1-2 left in the tank—optimize for progressive overload.',
    },
  },
  kino: {
    id: 'kino',
    name: 'Coach Kino',
    title: 'The Strengthener',
    description: 'Build raw strength with heavy compounds.',
    systemPrompt: `You are "Coach Kino". Your personality is minimalist, strength-focused, and practical.
    - You believe in doing a few things extremely well.
    - You focus on the "Big 3" (Squat, Bench, Deadlift) and Overhead Press.
    - You are obsessed with progressive overload and tracking PRs.
    - You dislike "fluff" exercises and overcomplication.
    - Tone: Direct, no-nonsense, motivating in a tough-love way.`,
    image: require('@/assets/images/coaches/Kino.jpeg'),
    trainingParams: {
      compoundSets: '2-3',
      isolationSets: '2',
      repsRange: '6-8',
      intensity: '0 RIR (to failure)',
      intensityDescription: 'Train to technical failure on working sets—no reps left in the tank',
      descriptionHint: 'Designed for all-out intensity—push each working set to failure.',
    },
  },
  maya: {
    id: 'maya',
    name: 'Motivational Maya',
    title: 'The Motivator',
    description: 'Build sustainable habits and stay consistent.',
    systemPrompt: `You are "Motivational Maya". Your personality is encouraging, positive, and mindset-focused.
    - You prioritize consistency and habit formation over perfect optimization.
    - You use positive reinforcement and encouraging language.
    - You talk about "momentum," "mindset," and "showing up."
    - You help the user overcome mental barriers and gym anxiety.
    - Tone: Energetic, supportive, empathetic, and uplifting.`,
    image: require('@/assets/images/coaches/Maya.jpeg'),
    trainingParams: {
      compoundSets: '3-4',
      isolationSets: '2',
      repsRange: '10-14',
      intensity: '2-3 RIR',
      intensityDescription: 'Keep 2-3 reps in reserve to stay energized and build consistent momentum',
      descriptionHint: 'Keep it sustainable—leave 2-3 reps in the tank and stay consistent.',
    },
  },
}

export const COACH_OPTIONS = Object.values(COACHES)

export const DEFAULT_COACH_ID: CoachId = 'ross'

export function getCoach(id?: string | null): Coach {
  if (!id || !COACHES[id as CoachId]) {
    return COACHES[DEFAULT_COACH_ID]
  }
  return COACHES[id as CoachId]
}

/**
 * Get training guidelines text for a coach, suitable for including in workout generation prompts
 */
export function getCoachTrainingGuidelines(id?: string | null): string {
  const coach = getCoach(id)
  const params = coach.trainingParams

  return `TRAINING STYLE (${coach.name}):
- Compound exercises: ${params.compoundSets} working sets
- Isolation exercises: ${params.isolationSets} working sets
- Rep range: ${params.repsRange} reps per set
- Intensity: ${params.intensity}
- ${params.intensityDescription}

DESCRIPTION GUIDANCE:
Write the workout "description" field like a personal trainer giving a brief 2-3 sentence overview. Include what the workout targets and how to approach intensity. Example style: "${params.descriptionHint}"`
}
