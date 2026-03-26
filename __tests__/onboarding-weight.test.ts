import { database } from '../lib/database'
import { persistOnboardingWeight } from '../lib/onboarding-weight'

jest.mock('../lib/database', () => ({
  database: {
    dailyLog: {
      updateDay: jest.fn(),
    },
  },
}))

const mockUpdateDay = jest.mocked(database.dailyLog.updateDay)

describe('persistOnboardingWeight', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('saves the onboarding weight to the daily log', async () => {
    await persistOnboardingWeight('user-1', 82.5)

    expect(mockUpdateDay).toHaveBeenCalledWith('user-1', {
      weightKg: 82.5,
    })
  })

  it('ignores missing or invalid onboarding weights', async () => {
    await persistOnboardingWeight('user-1', null)
    await persistOnboardingWeight('user-1', Number.NaN)

    expect(mockUpdateDay).not.toHaveBeenCalled()
  })
})
