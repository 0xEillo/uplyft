import { database } from '../lib/database'
import { persistOnboardingWeight } from '../lib/onboarding-weight'

jest.mock('../lib/database', () => ({
  database: {
    dailyLog: {
      updateDay: jest.fn(),
    },
    bodyLog: {
      getEntriesPage: jest.fn(),
      createEntry: jest.fn(),
    },
  },
}))

const mockUpdateDay = jest.mocked(database.dailyLog.updateDay)
const mockGetEntriesPage = jest.mocked(database.bodyLog.getEntriesPage)
const mockCreateEntry = jest.mocked(database.bodyLog.createEntry)

describe('persistOnboardingWeight', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetEntriesPage.mockResolvedValue({
      entries: [],
      hasMore: false,
    })
  })

  it('saves the onboarding weight to the daily log and seeds the first body log entry', async () => {
    await persistOnboardingWeight('user-1', 82.5)

    expect(mockUpdateDay).toHaveBeenCalledWith('user-1', {
      weightKg: 82.5,
    })
    expect(mockGetEntriesPage).toHaveBeenCalledWith(
      'user-1',
      0,
      1,
    )
    expect(mockCreateEntry).toHaveBeenCalledWith('user-1', {
      weightKg: 82.5,
    })
  })

  it('does not create a duplicate body log entry when one already exists', async () => {
    mockGetEntriesPage.mockResolvedValue({
      entries: [
        {
          id: 'entry-1',
          user_id: 'user-1',
          created_at: '2026-03-25T10:00:00.000Z',
          weight_kg: 82.5,
          body_fat_percentage: null,
          bmi: null,
          muscle_mass_kg: null,
          analysis_summary: null,
          images: [],
        },
      ],
      hasMore: false,
    })

    await persistOnboardingWeight('user-1', 82.5)

    expect(mockCreateEntry).not.toHaveBeenCalled()
  })

  it('ignores missing or invalid onboarding weights', async () => {
    await persistOnboardingWeight('user-1', null)
    await persistOnboardingWeight('user-1', Number.NaN)

    expect(mockUpdateDay).not.toHaveBeenCalled()
    expect(mockGetEntriesPage).not.toHaveBeenCalled()
    expect(mockCreateEntry).not.toHaveBeenCalled()
  })
})
