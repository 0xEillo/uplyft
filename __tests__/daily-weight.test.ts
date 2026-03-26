import {
  getDailyWeightForTimestamp,
  getDailyWeightsByLogDate,
  getLatestDailyWeightKg,
  normalizeLogDate,
} from '../supabase/functions/_shared/daily-weight'

describe('daily-weight helper', () => {
  it('normalizes YYYY-MM-DD values as-is', () => {
    expect(normalizeLogDate('2026-03-26')).toBe('2026-03-26')
  })

  it('throws for invalid dates', () => {
    expect(() => normalizeLogDate('not-a-date')).toThrow('Invalid log date')
  })

  it('returns the latest stored daily weight', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { weight_kg: 82.5 },
      error: null,
    })

    const client: any = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            not: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
          })),
        })),
      })),
    }

    await expect(getLatestDailyWeightKg(client, 'user-1')).resolves.toBe(82.5)
  })

  it('returns null when there is no latest stored daily weight', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    const client: any = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            not: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
          })),
        })),
      })),
    }

    await expect(getLatestDailyWeightKg(client, 'user-1')).resolves.toBeNull()
  })

  it('dedupes valid dates and ignores invalid ones when fetching daily weights', async () => {
    const inMock = jest.fn().mockResolvedValue({
      data: [
        { log_date: '2026-03-26', weight_kg: 82.5 },
        { log_date: '2026-03-27', weight_kg: 82.1 },
      ],
      error: null,
    })

    const client: any = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: inMock,
          })),
        })),
      })),
    }

    const result = await getDailyWeightsByLogDate(client, 'user-1', [
      '2026-03-26',
      '2026-03-26T08:30:00',
      '2026-03-27T12:00:00',
      'not-a-date',
    ])

    expect(inMock).toHaveBeenCalledWith('log_date', ['2026-03-26', '2026-03-27'])
    expect(result.get('2026-03-26')).toBe(82.5)
    expect(result.get('2026-03-27')).toBe(82.1)
  })

  it('short-circuits without querying when no valid dates remain', async () => {
    const from = jest.fn()
    const client: any = { from }

    const result = await getDailyWeightsByLogDate(client, 'user-1', ['invalid'])

    expect(from).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })

  it('resolves a weight for a specific timestamp', async () => {
    const inMock = jest.fn().mockResolvedValue({
      data: [{ log_date: '2026-03-26', weight_kg: 81.8 }],
      error: null,
    })

    const client: any = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: inMock,
          })),
        })),
      })),
    }

    await expect(
      getDailyWeightForTimestamp(client, 'user-1', '2026-03-26T09:15:00'),
    ).resolves.toBe(81.8)
  })
})
