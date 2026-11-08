import type { ToolSet } from 'npm:ai@7.0.162'

import { createUserClient } from '../../_shared/supabase.ts'
import { buildUserContextSummary, type UserContextSummary } from '../user-context.ts'
import { bodyTools } from './body.ts'
import { exerciseTools } from './exercises.ts'
import { planTools } from './plans.ts'
import type { Supabase } from './shared.ts'
import { strengthTools } from './strength.ts'
import { trainingTools } from './training.ts'
import { workoutTools } from './workouts.ts'

/** Loads the user's data snapshot and the chat tools bound to their account. */
export async function buildUserContext(
  userId: string,
  accessToken?: string,
): Promise<{ summary: UserContextSummary; tools: ToolSet }> {
  const supabase = createUserClient(accessToken)
  const summary = await buildUserContextSummary(userId, supabase as any)
  return { summary, tools: createChatTools(supabase, userId, summary) }
}

/**
 * The chat's tools: a small set that each answer a whole question in one
 * call. Definitions (names, descriptions, schemas) never depend on the user —
 * they sit in the cached prompt prefix. Only `execute` closures are per user.
 */
export function createChatTools(
  supabase: Supabase,
  userId: string,
  summary: UserContextSummary,
): ToolSet {
  const context = { supabase, userId, summary }
  return {
    ...workoutTools(context),
    ...strengthTools(context),
    ...trainingTools(context),
    ...bodyTools(context),
    ...planTools(context),
    ...exerciseTools(context),
  }
}
