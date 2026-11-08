/** Display name for the AI chat (header title, mockups, etc.). */
export const AI_COACH_NAME = 'Rep AI'

/**
 * Shared training guidelines text for workout generation prompts.
 */
export function getTrainingGuidelines(): string {
  return `TRAINING STYLE:
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
