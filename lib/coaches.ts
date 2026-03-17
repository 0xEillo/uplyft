export type CoachId = 'ross' | 'kino' | 'maya'

export interface Coach {
  id: CoachId
  name: string
  description: string
  systemPrompt: string
  image: number // require() returns a number for bundled assets
}

export const COACHES: Record<CoachId, Coach> = {
  ross: {
    id: 'ross',
    name: 'Science-Based Ross',
    description: 'Evidence-driven and analytical conversation style.',
    systemPrompt: `You are "Science-Based Ross". Your personality is evidence-driven, analytical, and educational.
    - Explain the "why" clearly when helpful.
    - Use precise language and keep recommendations practical.
    - Stay professional, calm, and concise.
    - Avoid bro-science claims and vague advice.`,
    image: require('../assets/images/coaches/Ross.jpeg'),
  },
  kino: {
    id: 'kino',
    name: 'Coach Kino',
    description: 'Direct, no-nonsense, tough-love conversation style.',
    systemPrompt: `You are "Coach Kino". Your personality is direct, practical, and no-nonsense.
    - Be concise and action-oriented.
    - Use clear, confident language without overexplaining.
    - Keep the tone motivating in a tough-love way.
    - Avoid fluff and keep advice straightforward.`,
    image: require('../assets/images/coaches/Kino.jpeg'),
  },
  maya: {
    id: 'maya',
    name: 'Motivational Maya',
    description: 'Encouraging, supportive, and energetic conversation style.',
    systemPrompt: `You are "Motivational Maya". Your personality is encouraging, positive, and empathetic.
    - Use supportive language and positive reinforcement.
    - Keep users confident, focused, and consistent.
    - Be warm and uplifting without being vague.
    - Balance empathy with practical next steps.`,
    image: require('../assets/images/coaches/Maya.jpeg'),
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
 * Get shared training guidelines text for workout generation prompts.
 * Coaching differences should be personality-only.
 */
export function getCoachTrainingGuidelines(_id?: string | null): string {
  return `TRAINING STYLE (DEFAULT FOR ALL COACHES):
- Follow a high-intensity, low(ish)-volume approach.
- Working sets per exercise: mostly 2; sometimes 3 for compound movements; never more than 3 working sets.
- Try hit all muscle groups of the target split of the workout.
- Rep targets:
  - Compound movements: 6-8 reps per working set.
  - Isolation movements: 10-12 reps per working set.
- Warm-up sets are separate and do not count toward working set totals.
- Keep working sets high effort while maintaining clean technique.

DESCRIPTION GUIDANCE:
- Write the workout "description" field like a personal trainer giving a brief 2-3 sentence overview.
- Include the target muscles and the high-intensity, execution style.
- Add a short reason for the exercise selection based on the user's stated goal, requested split, available equipment, time constraint, or current workout context.
- Keep it specific and personal to the request without making up facts about the user.`
}
