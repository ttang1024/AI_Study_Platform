import { describe, it, expect } from 'vitest'
import {
  numericDayLabel,
  shortDayLabel,
  bucketByWindow,
  bucketMinutes,
  bucketAccuracy,
} from '../analyticsBuckets'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('numericDayLabel', () => {
  it('formats as m/d', () => {
    expect(numericDayLabel(d(2026, 8, 2))).toBe('8/2')
  })
})

describe('shortDayLabel', () => {
  it('formats as a locale short month/day', () => {
    expect(shortDayLabel(d(2026, 8, 2))).toMatch(/Aug.*2/)
  })
})

describe('bucketByWindow', () => {
  it('produces one bucket per day, oldest first, for windows <= 31 days', () => {
    const today = d(2026, 8, 5)
    const rows = [
      { date: '2026-08-05T10:00:00Z' },
      { date: '2026-08-03T10:00:00Z' },
    ]
    const buckets = bucketByWindow(rows, { dateOf: (r) => r.date, days: 3, today })
    expect(buckets).toHaveLength(3)
    expect(buckets.map((b) => b.key)).toEqual(['2026-08-03', '2026-08-04', '2026-08-05'])
    expect(buckets[0].items).toHaveLength(1)
    expect(buckets[1].items).toHaveLength(0)
    expect(buckets[2].items).toHaveLength(1)
  })

  it('drops rows outside the window', () => {
    const today = d(2026, 8, 5)
    const rows = [{ date: '2026-01-01T00:00:00Z' }]
    const buckets = bucketByWindow(rows, { dateOf: (r) => r.date, days: 3, today })
    expect(buckets.every((b) => b.items.length === 0)).toBe(true)
  })

  it('collapses into weekly buckets when days > 31', () => {
    const today = d(2026, 8, 31)
    const rows = [{ date: '2026-08-31T00:00:00Z' }]
    const buckets = bucketByWindow(rows, { dateOf: (r) => r.date, days: 35, today })
    expect(buckets.length).toBe(5) // ceil(35/7)
    const totalItems = buckets.reduce((sum, b) => sum + b.items.length, 0)
    expect(totalItems).toBe(1)
  })

  it('matches only the YYYY-MM-DD prefix of the date string', () => {
    const today = d(2026, 8, 5)
    const rows = [{ date: '2026-08-05T23:59:59.999-08:00' }]
    const buckets = bucketByWindow(rows, { dateOf: (r) => r.date, days: 1, today })
    expect(buckets[0].items).toHaveLength(1)
  })
})

// bucketMinutes/bucketAccuracy default their window to `new Date()` (no injectable `today`),
// so these tests key off the real current day rather than a fixed date.
const todayKey = (() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})()

describe('bucketMinutes', () => {
  it('sums totalMinutes for the current day bucket', () => {
    const daily = [
      { date: `${todayKey}T01:00:00Z`, totalMinutes: 10 },
      { date: `${todayKey}T02:00:00Z`, totalMinutes: 5 },
    ]
    const buckets = bucketMinutes(daily, 1)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].value).toBe(15)
  })

  it('reports 0 minutes for a day with no rows', () => {
    expect(bucketMinutes([], 1)[0].value).toBe(0)
  })
})

describe('bucketAccuracy', () => {
  it('computes attempt-weighted accuracy percentage for the current day bucket', () => {
    const daily = [
      { date: `${todayKey}T01:00:00Z`, totalAttempts: 10, correctAttempts: 5 },
      { date: `${todayKey}T02:00:00Z`, totalAttempts: 30, correctAttempts: 27 },
    ]
    // (5+27)/(10+30) = 32/40 = 80%
    expect(bucketAccuracy(daily, 1)[0].value).toBe(80)
  })

  it('reports 0 for a bucket with no attempts', () => {
    expect(bucketAccuracy([], 1)[0].value).toBe(0)
  })
})
