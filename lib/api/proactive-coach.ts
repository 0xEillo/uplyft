import { supabase } from '@/lib/supabase'

export type ProactiveCoachMessage = {
  id: string
  user_id: string
  trigger_type:
    | 'workout_day_morning'
    | 'missed_workout'
    | 'comeback'
    | 'post_workout_followup'
  coach_id: string
  body: string
  metadata: Record<string, unknown>
  created_at: string
  consumed_at: string | null
}

export async function fetchUnconsumedProactiveMessages(
  userId: string,
): Promise<ProactiveCoachMessage[]> {
  const { data, error } = await supabase
    .from('proactive_coach_messages')
    .select('*')
    .eq('user_id', userId)
    .is('consumed_at', null)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ProactiveCoachMessage[]
}

export async function markProactiveMessagesConsumed(
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return

  const { error } = await supabase
    .from('proactive_coach_messages')
    .update({ consumed_at: new Date().toISOString() })
    .in('id', ids)

  if (error) throw error
}
