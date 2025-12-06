import { z } from 'zod'

import type { Profile } from '@/types/database.types'

import type { BodyLogMetrics } from './metadata'

const metricsSchema = z.object({
  body_fat_percentage: z.number().finite().nullable(),
  bmi: z.number().finite().nullable(),
  lean_mass_kg: z.number().finite().nullable().optional(),
  fat_mass_kg: z.number().finite().nullable().optional(),
  score_v_taper: z.number().int().min(0).max(100).nullable().optional(),
  score_chest: z.number().int().min(0).max(100).nullable().optional(),
  score_shoulders: z.number().int().min(0).max(100).nullable().optional(),
  score_abs: z.number().int().min(0).max(100).nullable().optional(),
  score_arms: z.number().int().min(0).max(100).nullable().optional(),
  score_back: z.number().int().min(0).max(100).nullable().optional(),
  score_legs: z.number().int().min(0).max(100).nullable().optional(),
  analysis_summary: z.string().min(1).max(400).nullable().optional(),
})

function nonNullNumbers(metrics: BodyLogMetrics) {
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [
      key,
      typeof value === 'number' && Number.isFinite(value)
        ? Number(value.toFixed(2))
        : value,
    ]),
  ) as BodyLogMetrics
}

export function parseBodyLogMetrics(
  raw: string | null | undefined,
): BodyLogMetrics {
  // Return all null metrics if content is empty or unparseable
  const nullMetrics: BodyLogMetrics = {
    body_fat_percentage: null,
    bmi: null,
    lean_mass_kg: null,
    fat_mass_kg: null,
    score_v_taper: null,
    score_chest: null,
    score_shoulders: null,
    score_abs: null,
    score_arms: null,
    score_back: null,
    score_legs: null,
    analysis_summary: null,
  }

  if (!raw) {
    console.warn('Body log analysis returned empty content, using null metrics')
    return nullMetrics
  }

  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/i)
  const candidate = jsonMatch ? jsonMatch[1] : raw

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    console.warn(
      'Body log analysis response was not valid JSON, using null metrics',
    )
    return nullMetrics
  }

  const result = metricsSchema.safeParse(parsed)

  if (!result.success) {
    console.warn(
      'Body log analysis response failed schema validation, using null metrics',
    )
    return nullMetrics
  }

  return nonNullNumbers(result.data)
}

interface PromptInput {
  profile: Pick<Profile, 'age' | 'height_cm' | 'weight_kg' | 'display_name'>
  createdAt: string
}

export function buildBodyLogPrompt({
  profile,
  createdAt,
}: PromptInput): string {
  const lines: string[] = []

  lines.push('You are an unforgiving physique analyst. No sugarcoating.')
  lines.push(
    'Given one body photo, output raw measurements, physique scores, and a brief justification in JSON only.',
  )

  const contextParts: string[] = [
    `captured_at="${new Date(createdAt).toISOString()}"`,
  ]

  if (profile?.display_name) contextParts.push(`name="${profile.display_name}"`)
  if (typeof profile?.age === 'number') contextParts.push(`age=${profile.age}`)
  if (typeof profile?.height_cm === 'number')
    contextParts.push(`height_cm=${profile.height_cm}`)
  if (typeof profile?.weight_kg === 'number')
    contextParts.push(`weight_kg=${profile.weight_kg}`)

  lines.push(`Known facts: ${contextParts.join(', ')}`)

  lines.push(
    [
      'Output requirements:',
      '1. Be ruthlessly precise. Estimate body fat % and BMI.',
      '2. Provide a score out of 100 for the following attributes based on aesthetic standards (symmetry, proportion, definition): v-taper, chest, shoulders, abs, arms, back, legs.',
      '3. Return a single JSON object with keys: body_fat_percentage, bmi, score_v_taper, score_chest, score_shoulders, score_abs, score_arms, score_back, score_legs, analysis_summary.',
      '4. Values must be numbers (use null only if physically impossible to estimate).',
      '5. analysis_summary must be succinct and to the point, 1-2 lines maximum explaining the key visual cues that drove your estimates. Address the user directly as "You" (e.g., "Your shoulder definition...").',
      '6. No extra text, disclaimers, markdown, or commentary—JSON only.',
    ].join(' '),
  )

  lines.push(
    'Example (format only): {"body_fat_percentage": 18.6, "bmi": 25.3, "score_v_taper": 75, "score_chest": 60, "score_shoulders": 70, "score_abs": 55, "score_arms": 65, "score_back": 70, "score_legs": 60, "analysis_summary": "Prominent abdominal definition and visible shoulder striations indicate mid-teens body fat."}',
  )

  return lines.join('\n')
}
