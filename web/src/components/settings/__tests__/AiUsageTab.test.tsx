import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiUsageTab } from '../AiUsageTab'
import { analyticsService, type AiUsage } from '../../../services/analyticsService'

vi.mock('../../../services/analyticsService', () => ({
  analyticsService: { getAiUsage: vi.fn() },
}))

const getAiUsage = vi.mocked(analyticsService.getAiUsage)

const makeUsage = (overrides: Partial<AiUsage> = {}): AiUsage => ({
  from: '2026-06-14',
  to: '2026-07-13',
  totals: {
    calls: 5,
    promptTokens: 6900,
    completionTokens: 2600,
    cachedPromptTokens: 300,
    totalTokens: 9500,
    estimatedCostUsd: 0.173,
  },
  byOperation: [
    { key: 'flashcards', calls: 1, totalTokens: 3900, estimatedCostUsd: 0.09 },
    { key: 'quiz:text', calls: 3, totalTokens: 4300, estimatedCostUsd: 0.043 },
  ],
  byModel: [
    { key: 'openai/gpt-4o', calls: 2, totalTokens: 4400, estimatedCostUsd: 0.095 },
  ],
  daily: [],
  dailyTokenLimit: 0,
  tokensUsedToday: 0,
  ...overrides,
})

describe('AiUsageTab', () => {
  beforeEach(() => {
    getAiUsage.mockReset()
  })

  it('renders totals and both breakdowns', async () => {
    getAiUsage.mockResolvedValue(makeUsage())
    render(<AiUsageTab />)

    expect(await screen.findByText('$0.17')).toBeInTheDocument()  // estimated cost
    expect(screen.getByText('9.5K')).toBeInTheDocument()          // compact tokens
    expect(screen.getByText('5')).toBeInTheDocument()             // calls

    // "quiz:text" is humanized rather than shown raw.
    expect(screen.getByText('Quiz (text)')).toBeInTheDocument()
    expect(screen.getByText('Flashcards')).toBeInTheDocument()
    expect(screen.getByText('openai/gpt-4o')).toBeInTheDocument()
  })

  it('makes clear the spend is on the user’s own provider bill', async () => {
    getAiUsage.mockResolvedValue(makeUsage())
    render(<AiUsageTab />)

    expect(await screen.findByText(/billed by your provider, not by us/i)).toBeInTheDocument()
  })

  it('reports sub-cent spend as <$0.01 rather than rounding it away to $0.00', async () => {
    getAiUsage.mockResolvedValue(
      makeUsage({
        totals: {
          calls: 1, promptTokens: 10, completionTokens: 5,
          cachedPromptTokens: 0, totalTokens: 15, estimatedCostUsd: 0.004,
        },
        byOperation: [], byModel: [],
      }),
    )
    render(<AiUsageTab />)

    expect(await screen.findByText('<$0.01')).toBeInTheDocument()
  })

  it('hides the quota bar when the daily limit is unlimited (0)', async () => {
    getAiUsage.mockResolvedValue(makeUsage({ dailyTokenLimit: 0 }))
    render(<AiUsageTab />)

    await screen.findByText('$0.17')
    expect(screen.queryByText(/today's token budget/i)).not.toBeInTheDocument()
  })

  it('warns once the day’s spend crosses 80% of the limit', async () => {
    getAiUsage.mockResolvedValue(
      makeUsage({ dailyTokenLimit: 10_000, tokensUsedToday: 9_000 }),
    )
    render(<AiUsageTab />)

    expect(await screen.findByText(/today's token budget/i)).toBeInTheDocument()
    expect(screen.getByText(/close to the daily limit/i)).toBeInTheDocument()
  })

  it('does not warn while comfortably under the limit', async () => {
    getAiUsage.mockResolvedValue(
      makeUsage({ dailyTokenLimit: 10_000, tokensUsedToday: 1_000 }),
    )
    render(<AiUsageTab />)

    expect(await screen.findByText(/today's token budget/i)).toBeInTheDocument()
    expect(screen.queryByText(/close to the daily limit/i)).not.toBeInTheDocument()
  })

  it('refetches with a new window when the range changes', async () => {
    getAiUsage.mockResolvedValue(makeUsage())
    render(<AiUsageTab />)
    await screen.findByText('$0.17')

    await userEvent.click(screen.getByRole('button', { name: '7 days' }))

    await waitFor(() => expect(getAiUsage).toHaveBeenCalledTimes(2))
    // The 7-day window must ask for a later 'from' than the 30-day one did.
    const [firstFrom] = getAiUsage.mock.calls[0]
    const [secondFrom] = getAiUsage.mock.calls[1]
    expect(secondFrom! > firstFrom!).toBe(true)
  })

  it('surfaces a failure instead of rendering an empty report', async () => {
    getAiUsage.mockRejectedValue(new Error('boom'))
    render(<AiUsageTab />)

    expect(await screen.findByText(/could not load usage/i)).toBeInTheDocument()
  })
})
