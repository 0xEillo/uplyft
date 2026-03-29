import { BodyPartSlug } from '@/lib/body-mapping'
import { EXERCISE_MUSCLE_FILTER_GROUPS } from '@/lib/utils/muscle-filters'

export interface MuscleBodyMapping {
  slug: BodyPartSlug
  side: 'front' | 'back'
  bodyHalf: 'upper' | 'lower'
}

export const BODY_HALF_CONFIG = {
  upper: { scale: 0.52, offsetY: 42 },
  lower: { scale: 0.36, offsetY: -26 },
}

export const MUSCLE_TO_BODY_PARTS: Record<string, MuscleBodyMapping> = {
  // Upper body muscles
  Chest: { slug: 'chest', side: 'front', bodyHalf: 'upper' },
  Shoulders: { slug: 'deltoids', side: 'front', bodyHalf: 'upper' },
  Triceps: { slug: 'triceps', side: 'back', bodyHalf: 'upper' },
  Biceps: { slug: 'biceps', side: 'front', bodyHalf: 'upper' },
  Back: { slug: 'upper-back', side: 'back', bodyHalf: 'upper' },
  Lats: { slug: 'upper-back', side: 'back', bodyHalf: 'upper' },
  Traps: { slug: 'trapezius', side: 'back', bodyHalf: 'upper' },
  Abs: { slug: 'abs', side: 'front', bodyHalf: 'upper' },
  Core: { slug: 'abs', side: 'front', bodyHalf: 'upper' },
  'Lower Back': { slug: 'lower-back', side: 'back', bodyHalf: 'upper' },
  Forearms: { slug: 'forearm', side: 'front', bodyHalf: 'upper' },
  // Lower body muscles
  Glutes: { slug: 'gluteal', side: 'back', bodyHalf: 'lower' },
  Quads: { slug: 'quadriceps', side: 'front', bodyHalf: 'lower' },
  Hamstrings: { slug: 'hamstring', side: 'back', bodyHalf: 'lower' },
  Calves: { slug: 'calves', side: 'back', bodyHalf: 'lower' },
}

export interface MuscleChipRenderData {
  group: string
  bodyData: { slug: BodyPartSlug; intensity: number }[]
  side: 'front' | 'back'
  scale: number
  offsetY: number
}

export const MUSCLE_CHIP_RENDER_DATA: MuscleChipRenderData[] = EXERCISE_MUSCLE_FILTER_GROUPS.map(
  (group) => {
    const mapping = MUSCLE_TO_BODY_PARTS[group]
    if (!mapping) return null

    return {
      group,
      bodyData: [{ slug: mapping.slug, intensity: 1 }],
      side: mapping.side,
      scale: BODY_HALF_CONFIG[mapping.bodyHalf].scale,
      offsetY: BODY_HALF_CONFIG[mapping.bodyHalf].offsetY,
    }
  },
).filter((chip): chip is MuscleChipRenderData => chip !== null)
