// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { z } from 'https://esm.sh/zod@3.23.8'

export interface BodyLogMetrics {
  body_fat_percentage: number | null
  bmi: number | null
  lean_mass_kg?: number | null
  fat_mass_kg?: number | null
  score_v_taper?: number | null
  score_chest?: number | null
  score_shoulders?: number | null
  score_abs?: number | null
  score_arms?: number | null
  score_back?: number | null
  score_legs?: number | null
  analysis_summary: string | null
}

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
  analysis_summary: z
    .union([z.string().min(1).max(400).trim(), z.null()])
    .optional()
    .transform((value: string | null | undefined) => {
      if (value === undefined || value === null) return null
      return typeof value === 'string' ? value.trim() : value
    }),
})

function nonNullNumbers(metrics: BodyLogMetrics): BodyLogMetrics {
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

  // deno-lint-ignore no-explicit-any
  let parsed: any
  try {
    parsed = JSON.parse(candidate)
  } catch (error) {
    console.warn(
      'Body log analysis response was not valid JSON, using null metrics',
      error,
    )
    return nullMetrics
  }

  const result = metricsSchema.safeParse(parsed)

  if (!result.success) {
    console.warn(
      'Body log analysis response failed schema validation, using null metrics',
      result.error,
    )
    return nullMetrics
  }

  return nonNullNumbers(result.data)
}

export interface PromptInput {
  age?: number | null
  height_cm?: number | null
  weight_kg?: number | null
  display_name?: string | null
  createdAt: string
}

export function buildBodyLogPrompt({
  display_name,
  age,
  height_cm,
  weight_kg,
  createdAt,
}: PromptInput): string {
  const lines: string[] = []

  lines.push('You are an unforgiving physique analyst. No sugarcoating.')
  lines.push(
    'Given body photos, output raw measurements, physique scores, and a brief justification in JSON only.',
  )

  const contextParts: string[] = [
    `captured_at="${new Date(createdAt).toISOString()}"`,
  ]

  if (display_name) contextParts.push(`name="${display_name}"`)
  if (typeof age === 'number') contextParts.push(`age=${age}`)
  if (typeof height_cm === 'number') contextParts.push(`height_cm=${height_cm}`)
  if (typeof weight_kg === 'number') contextParts.push(`weight_kg=${weight_kg}`)

  lines.push(`Known facts: ${contextParts.join(', ')}`)

  lines.push(
    [
      'Output requirements:',
      '1. Be ruthlessly precise. Estimate body fat % and BMI.',
      '2. Provide a ruthlessly accurate score out of 100 (where 0 is the worst physique imaginable and 100 is elite almost inhuman physique)for the following attributes based on aesthetic standards (symmetry, proportion, definition): v-taper, chest, shoulders, abs, arms, back, legs.',
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
