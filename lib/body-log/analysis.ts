import { z } from 'zod'

import type { Profile } from '@/types/database.types'

import type { BodyLogMetrics } from './metadata'

const metricsSchema = z.object({
  weight_kg: z.number().finite().nullable(),
  body_fat_percentage: z.number().finite().nullable(),
  bmi: z.number().finite().nullable(),
  muscle_mass_kg: z.number().finite().nullable(),
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
    weight_kg: null,
    body_fat_percentage: null,
    bmi: null,
    muscle_mass_kg: null,
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
  } catch (error) {
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
  lines.push('Given one body photo, output raw measurements in JSON only.')

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
      '1. Be ruthlessly precise. Estimate body fat %, BMI, and muscle mass (kg).',
      '2. Return a single JSON object with keys: weight_kg, body_fat_percentage, bmi, muscle_mass_kg.',
      '3. Values must be numbers (use null only if physically impossible to estimate).',
      '4. No text, disclaimers, markdown, or commentary—JSON only.',
    ].join(' '),
  )

  lines.push(
    'Example (format only): {"weight_kg": 82.4, "body_fat_percentage": 18.6, "bmi": 25.3, "muscle_mass_kg": 37.1}',
  )

  return lines.join('\n')
}
