import { coerceBodyweightKg, hasValidBodyweightKg } from '@/lib/bodyweight'

describe('bodyweight helpers', () => {
  it('accepts positive numeric values', () => {
    expect(coerceBodyweightKg(82.5)).toBe(82.5)
    expect(hasValidBodyweightKg(82.5)).toBe(true)
  })

  it('accepts numeric strings returned by database clients', () => {
    expect(coerceBodyweightKg('82.5')).toBe(82.5)
    expect(hasValidBodyweightKg('82.5')).toBe(true)
  })

  it('rejects missing, non-finite, and non-positive values', () => {
    expect(coerceBodyweightKg(null)).toBeNull()
    expect(coerceBodyweightKg(Number.NaN)).toBeNull()
    expect(coerceBodyweightKg(0)).toBeNull()
    expect(coerceBodyweightKg('-1')).toBeNull()
    expect(coerceBodyweightKg('not-a-weight')).toBeNull()
  })
})
