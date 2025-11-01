import { createServiceClient, createUserClient } from '../_shared/supabase.ts'
import { ApiError } from './errors.ts'

export function extractAccessToken(req: Request): string | undefined {
  const bearer = req.headers.get('Authorization')
  if (!bearer) return undefined
  return bearer.startsWith('Bearer ')
    ? bearer.slice('Bearer '.length).trim()
    : undefined
}

export async function authorizeUser(req: Request, userId: string) {
  const accessToken = extractAccessToken(req)
  const userClient = createUserClient(accessToken)
  const serviceClient = createServiceClient()

  const { data: profile, error } = await userClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  return { userClient, serviceClient }
}
