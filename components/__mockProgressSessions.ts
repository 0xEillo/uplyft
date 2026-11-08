// TEMPORARY: mock data for previewing the Progress tab. Delete after review.
import type { ExerciseProgressSession } from '@/components/ExerciseProgressTab'

export function buildMockProgressSessions(): ExerciseProgressSession[] {
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const sessions: ExerciseProgressSession[] = []
  const start = new Date()
  start.setDate(start.getDate() - 180)
  let topWeight = 70
  for (let day = 0, i = 0; day <= 180; day += 3 + Math.round(rand() * 3), i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + day)
    // Slow progressive overload, with a deload every ~6 weeks.
    const deload = i % 12 === 11
    if (!deload && rand() > 0.45) topWeight += 2.5
    const working = deload ? topWeight - 15 : topWeight
    const setCount = deload ? 3 : 3 + Math.round(rand())
    const sets = [
      { weight: 40, reps: 10, is_warmup: true },
      ...Array.from({ length: setCount }, (_, s) => ({
        weight: working - (s === setCount - 1 ? 5 : 0),
        reps: Math.max(3, Math.round((deload ? 8 : 6) + rand() * 3 - s)),
        is_warmup: false,
      })),
    ]
    sessions.push({ date: date.toISOString(), sets })
  }
  return sessions.reverse()
}
