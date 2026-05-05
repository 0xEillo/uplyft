import { formatWeightInputValue } from '../lib/utils/weight-input-format'

describe('formatWeightInputValue', () => {
  test('preserves meaningful decimals for workout inputs', () => {
    expect(formatWeightInputValue(17.5)).toBe('17.5')
    expect(formatWeightInputValue(17.25)).toBe('17.25')
  })

  test('trims trailing zeros and floating point noise', () => {
    expect(formatWeightInputValue(18)).toBe('18')
    expect(formatWeightInputValue(40.0000000007)).toBe('40')
  })

  test('returns null for missing or invalid values', () => {
    expect(formatWeightInputValue(null)).toBeNull()
    expect(formatWeightInputValue(undefined)).toBeNull()
    expect(formatWeightInputValue(Number.NaN)).toBeNull()
  })
})
