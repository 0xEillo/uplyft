import { beginSingleFlight, endSingleFlight } from '../lib/utils/single-flight'

describe('single-flight guard', () => {
  test('allows the first flight and blocks a concurrent duplicate', () => {
    const ref = { current: false }

    expect(beginSingleFlight(ref)).toBe(true)
    expect(ref.current).toBe(true)
    expect(beginSingleFlight(ref)).toBe(false)
    expect(ref.current).toBe(true)
  })

  test('allows a new flight after the prior one ends', () => {
    const ref = { current: false }

    expect(beginSingleFlight(ref)).toBe(true)
    endSingleFlight(ref)

    expect(ref.current).toBe(false)
    expect(beginSingleFlight(ref)).toBe(true)
  })
})
