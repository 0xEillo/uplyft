import {
  findBodyPartSlugForMuscle,
  getBodyPartDisplayName,
  getPrimaryMuscleForBodyPart,
  getTargetMusclesForBodyPart,
} from '@/lib/body-mapping'

describe('body mapping helpers', () => {
  test('keeps upper-back mapping explicit and narrow', () => {
    expect(getBodyPartDisplayName('upper-back')).toBe('Upper Back')
    expect(getPrimaryMuscleForBodyPart('upper-back')).toBe('Back')
    expect(getTargetMusclesForBodyPart('upper-back')).toEqual(['Back'])
  })

  test('normalizes core body regions to the core muscle group', () => {
    expect(getPrimaryMuscleForBodyPart('abs')).toBe('Core')
    expect(getTargetMusclesForBodyPart('abs')).toEqual(['Core'])
    expect(getPrimaryMuscleForBodyPart('obliques')).toBe('Core')
    expect(getTargetMusclesForBodyPart('obliques')).toEqual(['Core'])
  })

  test('can resolve a body part slug from a muscle group', () => {
    expect(findBodyPartSlugForMuscle('Back')).toBe('upper-back')
    expect(findBodyPartSlugForMuscle('Lower Back')).toBe('lower-back')
    expect(findBodyPartSlugForMuscle('Traps')).toBe('trapezius')
    expect(findBodyPartSlugForMuscle('Unknown')).toBeNull()
  })
})
