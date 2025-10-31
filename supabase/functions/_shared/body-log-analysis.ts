// @ts-ignore: Supabase Edge Functions run in Deno and resolve remote modules
// eslint-disable-next-line import/no-unresolved
import { z } from 'https://esm.sh/zod@3.23.8'

export interface BodyLogMetrics {
  body_fat_percentage: number | null
  bmi: number | null
  analysis_summary: string | null
}

const metricsSchema = z.object({
  body_fat_percentage: z.number().finite().nullable(),
  bmi: z.number().finite().nullable(),
  analysis_summary: z
    .union([z.string().min(1).max(400).trim(), z.null()])
    .optional()
    .transform((value) => {
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
    'Given one body photo, output raw measurements plus a brief justification in JSON only.',
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
      '1. Be ruthlessly precise. Estimate body fat % and BMI only.',
      '2. Return a single JSON object with keys: body_fat_percentage, bmi, analysis_summary.',
      '3. Values must be numbers (use null only if physically impossible to estimate).',
      '4. analysis_summary must be succinct and to the point, 1-2 lines maximum explaining the key visual cues that drove your estimates.',
      '5. No extra text, disclaimers, markdown, or commentary—JSON only.',
    ].join(' '),
  )

  lines.push(
    'Example (format only): {"body_fat_percentage": 18.6, "bmi": 25.3, "analysis_summary": "Prominent abdominal definition and visible shoulder striations indicate mid-teens body fat."}',
  )

  return lines.join('\n')
}
