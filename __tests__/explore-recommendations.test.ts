import {
  parseStoredEquipmentPreference,
  sortProgramsByPopularity,
  sortProgramsForUser,
} from '@/lib/utils/explore-recommendations'
import type { ExploreProgramWithRoutines } from '@/types/database.types'

function createProgram(
  overrides: Partial<ExploreProgramWithRoutines & { routine_count: number }> & {
    id: string
    name: string
  },
): ExploreProgramWithRoutines & { routine_count: number } {
  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? null,
    level: overrides.level ?? 'beginner',
    goal: overrides.goal ?? 'build_muscle',
    is_published: true,
    display_order: overrides.display_order ?? 1,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-01-01T00:00:00.000Z',
    routine_count: overrides.routine_count ?? overrides.routines?.length ?? 1,
    routines:
      overrides.routines ??
      [
        {
          id: `${overrides.id}-routine-1`,
          name: `${overrides.name} Routine`,
          description: null,
          image_url: null,
          level: overrides.level ?? 'beginner',
          duration_minutes: 45,
          equipment: ['Barbell'],
          is_published: true,
          display_order: 1,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          exercises: [],
        },
      ],
  }
}

describe('explore recommendations', () => {
  it('prioritizes gym-friendly programs in the popular section', () => {
    const gymProgram = createProgram({
      id: 'gym',
      name: 'Push Pull Legs',
      display_order: 3,
      routine_count: 3,
      routines: [
        {
          id: 'gym-routine',
          name: 'Push',
          description: null,
          image_url: null,
          level: 'beginner',
          duration_minutes: 45,
          equipment: ['Barbell', 'Machine', 'Cable'],
          is_published: true,
          display_order: 1,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          exercises: [],
        },
      ],
    })
    const bodyweightProgram = createProgram({
      id: 'bodyweight',
      name: 'Bodyweight Basics',
      display_order: 1,
      routine_count: 3,
      routines: [
        {
          id: 'bw-routine',
          name: 'Bodyweight Day',
          description: null,
          image_url: null,
          level: 'beginner',
          duration_minutes: 30,
          equipment: ['Bodyweight'],
          is_published: true,
          display_order: 1,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          exercises: [],
        },
      ],
    })

    const sorted = sortProgramsByPopularity([bodyweightProgram, gymProgram])

    expect(sorted.map((program) => program.id)).toEqual(['gym', 'bodyweight'])
  })

  it('recommends equipment-compatible programs for home users', () => {
    const gymProgram = createProgram({
      id: 'gym',
      name: 'Upper Lower Split',
      level: 'intermediate',
      goal: 'build_muscle',
      routine_count: 4,
      routines: [
        {
          id: 'gym-routine',
          name: 'Upper',
          description: null,
          image_url: null,
          level: 'intermediate',
          duration_minutes: 60,
          equipment: ['Barbell', 'Machine'],
          is_published: true,
          display_order: 1,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          exercises: [],
        },
      ],
    })
    const bodyweightProgram = createProgram({
      id: 'bodyweight',
      name: 'Bodyweight Basics',
      level: 'beginner',
      goal: 'build_muscle',
      routine_count: 3,
      routines: [
        {
          id: 'bw-routine',
          name: 'Push Day',
          description: null,
          image_url: null,
          level: 'beginner',
          duration_minutes: 30,
          equipment: ['Bodyweight'],
          is_published: true,
          display_order: 2,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          exercises: [],
        },
      ],
    })

    const sorted = sortProgramsForUser([gymProgram, bodyweightProgram], {
      profile: {
        goals: ['build_muscle'],
        experience_level: 'beginner',
        commitment: null,
        commitment_frequency: '3_times',
      },
      equipmentPreference: 'bodyweight',
    })

    expect(sorted[0]?.id).toBe('bodyweight')
  })

  it('recommends strength-focused programs when the goal and cadence match', () => {
    const strengthProgram = createProgram({
      id: 'strength',
      name: '5x5 Strength',
      goal: 'get_stronger',
      level: 'beginner',
      display_order: 4,
      routine_count: 3,
      routines: [
        {
          id: 'strength-routine',
          name: 'Bench & Row',
          description: null,
          image_url: null,
          level: 'beginner',
          duration_minutes: 45,
          equipment: ['Barbell'],
          is_published: true,
          display_order: 1,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          exercises: [],
        },
      ],
    })
    const bodybuildingProgram = createProgram({
      id: 'bodybuilding',
      name: 'Arnold Split',
      goal: 'build_muscle',
      level: 'advanced',
      display_order: 1,
      routine_count: 6,
      routines: [
        {
          id: 'bodybuilding-routine',
          name: 'Chest & Back',
          description: null,
          image_url: null,
          level: 'advanced',
          duration_minutes: 75,
          equipment: ['Barbell', 'Cable', 'Dumbbell'],
          is_published: true,
          display_order: 1,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          exercises: [],
        },
      ],
    })

    const sorted = sortProgramsForUser([bodybuildingProgram, strengthProgram], {
      profile: {
        goals: ['gain_strength'],
        experience_level: 'beginner',
        commitment: null,
        commitment_frequency: '3_times',
      },
      equipmentPreference: 'full_gym',
    })

    expect(sorted[0]?.id).toBe('strength')
  })

  it('parses stored equipment preferences from async storage values', () => {
    expect(parseStoredEquipmentPreference(JSON.stringify('bodyweight'))).toBe(
      'bodyweight',
    )
    expect(parseStoredEquipmentPreference('full_gym')).toBe('full_gym')
    expect(parseStoredEquipmentPreference('"unknown"')).toBeNull()
  })
})
