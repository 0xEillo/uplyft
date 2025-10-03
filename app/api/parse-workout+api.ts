import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

export async function POST(request: Request) {
  try {
    const { notes } = await request.json()

    if (!notes || typeof notes !== 'string') {
      return Response.json({ error: 'Notes are required' }, { status: 400 })
    }

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        title: z.string().describe('A catchy title for the workout'),
        description: z
          .string()
          .describe('A brief description of what was done'),
        duration: z
          .string()
          .describe('Duration in format like "1:32:45" or "45:12"'),
        calories: z.number().describe('Estimated calories burned'),
        exercises: z.number().describe('Number of exercises performed'),
      }),
      prompt: `Parse this workout note and extract structured information: "${notes}"
      
      Create a catchy title, brief description, estimate duration, calories burned, and count exercises.
      If information is not provided, make reasonable estimates based on the workout described.`,
    })

    return Response.json({
      workout: result.object,
    })
  } catch (error) {
    console.error('Error parsing workout:', error)
    return Response.json({ error: 'Failed to parse workout' }, { status: 500 })
  }
}
