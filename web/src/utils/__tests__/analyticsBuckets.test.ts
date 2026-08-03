import { describe, expect, it } from 'vitest'
import { bucketAccuracy, bucketByWindow, bucketMinutes, numericDayLabel, shortDayLabel } from '@core/utils/analyticsBuckets'

// Shared by web's AnalyticsSection and rn's insights charts — these lock in the bucketing both
// depend on. `today` is pinned so the assertions don't drift with the wall clock.
const TODAY = new Date(2026, 7, 2) // 2 Aug 2026, local midnight

const dayOf = (row: { date: string }) => row.date

describe('bucketByWindow', () => {
  it('emits one bucket per day for windows of 31 days or fewer, oldest first', () => {
    const buckets = bucketByWindow([], { dateOf: dayOf, days: 7, today: TODAY })
    expect(buckets).toHaveLength(7)
    expect(buckets[0].label).toBe('7/27')
    expect(buckets[6].label).toBe('8/2')
  })

  it('collapses longer windows into weekly buckets labelled by the week start', () => {
    const buckets = bucketByWindow([], { dateOf: dayOf, days: 90, today: TODAY })
    expect(buckets).toHaveLength(Math.ceil(90 / 7))
    // Last bucket covers the 7 days ending today, so its label is 6 days back.
    expect(buckets[buckets.length - 1].label).toBe('7/27')
  })

  it('keeps empty buckets so quiet stretches read as gaps', () => {
    const buckets = bucketByWindow([{ date: '2026-08-02' }], { dateOf: dayOf, days: 7, today: TODAY })
    expect(buckets.filter(b => b.items.length === 0)).toHaveLength(6)
    expect(buckets[6].items).toHaveLength(1)
  })

  // The bug this consolidation fixed: rn matched on `new Date(iso)` and then took the local day,
  // which files a midnight-UTC date onto the previous day anywhere west of UTC.
  it('matches on the raw YYYY-MM-DD prefix, not a parsed Date', () => {
    const buckets = bucketByWindow([{ date: '2026-08-02T00:00:00Z' }], { dateOf: dayOf, days: 7, today: TODAY })
    expect(buckets[6].items).toHaveLength(1)
    expect(buckets[5].items).toHaveLength(0)
  })

  it('drops rows outside the window', () => {
    const buckets = bucketByWindow([{ date: '2020-01-01' }], { dateOf: dayOf, days: 7, today: TODAY })
    expect(buckets.every(b => b.items.length === 0)).toBe(true)
  })

  it('takes an alternate label formatter', () => {
    const buckets = bucketByWindow([], { dateOf: dayOf, days: 7, today: TODAY, labelOf: shortDayLabel })
    expect(buckets[6].label).toBe(shortDayLabel(TODAY))
    expect(numericDayLabel(TODAY)).toBe('8/2')
  })
})

describe('bucketMinutes', () => {
  it('sums minutes falling in the same bucket', () => {
    const buckets = bucketMinutes(
      [
        { date: '2026-08-02', totalMinutes: 30 },
        { date: '2026-08-01', totalMinutes: 12 },
      ],
      7,
    )
    // Default `today` is now, so assert on totals rather than positions.
    expect(buckets.reduce((sum, b) => sum + b.value, 0)).toBe(42)
  })
})

describe('bucketAccuracy', () => {
  it('is attempt-weighted, not an average of daily percentages', () => {
    // One perfect 1-question day and one 50% 40-question day. Averaging the daily rates gives 75%;
    // the correct attempt-weighted answer is 21/41 ≈ 51%.
    const buckets = bucketAccuracy(
      [
        { date: '2026-08-02', totalAttempts: 1, correctAttempts: 1 },
        { date: '2026-08-01', totalAttempts: 40, correctAttempts: 20 },
      ],
      90, // weekly bucketing puts both days in one bucket
    )
    const withData = buckets.filter(b => b.value > 0)
    expect(withData).toHaveLength(1)
    expect(withData[0].value).toBe(51)
  })

  it('reports 0 for buckets with no attempts', () => {
    const buckets = bucketAccuracy([], 7)
    expect(buckets.every(b => b.value === 0)).toBe(true)
  })
})
