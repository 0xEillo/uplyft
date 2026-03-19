import {
  getAdaptiveWeeklyPushLimit,
  getScheduledReminderPlan,
} from '../supabase/functions/_shared/retention'

describe('retention scheduler helpers', () => {
  it('treats flexible frequency users as catch-up eligible when they fall behind pace', () => {
    const plan = getScheduledReminderPlan({
      todayDateKey: '2026-03-18',
      localWeekday: 'wednesday',
      workoutDateKeys: ['2026-03-16'],
      commitment: null,
      commitmentFrequency: '4_times',
    })

    expect(plan.weeklyTarget).toBe(4)
    expect(plan.workoutsThisWeek).toBe(1)
    expect(plan.behindTargetBy).toBe(1)
    expect(plan.isPlannedWorkoutDay).toBe(false)
    expect(plan.isBehindWeeklyPace).toBe(true)
    expect(plan.shouldSendScheduledReminderToday).toBe(true)
  })

  it('marks the last remaining day as urgent when a user still needs a workout', () => {
    const plan = getScheduledReminderPlan({
      todayDateKey: '2026-03-22',
      localWeekday: 'sunday',
      workoutDateKeys: ['2026-03-16', '2026-03-18', '2026-03-20'],
      commitment: null,
      commitmentFrequency: '4_times',
    })

    expect(plan.workoutsRemainingThisWeek).toBe(1)
    expect(plan.daysRemainingThisWeek).toBe(1)
    expect(plan.needsWorkoutTodayToHitGoal).toBe(true)
    expect(plan.shouldSendScheduledReminderToday).toBe(true)
  })

  it('scales the weekly push cap when the user set an explicit target', () => {
    expect(
      getAdaptiveWeeklyPushLimit(3, {
        commitment: null,
        commitmentFrequency: '4_times',
      }),
    ).toBe(5)

    expect(
      getAdaptiveWeeklyPushLimit(3, {
        commitment: ['monday', 'thursday'],
        commitmentFrequency: null,
      }),
    ).toBe(3)
  })

  it('keeps the base push cap for users without an explicit workout target', () => {
    expect(
      getAdaptiveWeeklyPushLimit(3, {
        commitment: ['not_sure'],
        commitmentFrequency: null,
      }),
    ).toBe(3)

    expect(
      getAdaptiveWeeklyPushLimit(3, {
        commitment: null,
        commitmentFrequency: 'not_sure',
      }),
    ).toBe(3)
  })
})
