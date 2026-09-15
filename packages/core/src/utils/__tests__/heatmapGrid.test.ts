import { describe, it, expect } from 'vitest'
import { buildHeatmapGrid, heatmapDayKey, HEATMAP_WEEKS } from '../heatmapGrid'
import type { ActivityHeatmap } from '../../services/analyticsService'

const heatmap = (
  from: string,
  to: string,
  days: { date: string; reviews: number; studyMinutes: number }[] = [],
): ActivityHeatmap => ({
  from,
  to,
  days,
  totalReviews: days.reduce((n, d) => n + d.reviews, 0),
  totalStudyMinutes: days.reduce((n, d) => n + d.studyMinutes, 0),
  activeDays: days.length,
})

const flat = (data: ActivityHeatmap) => buildHeatmapGrid(data).flat()
const cellFor = (data: ActivityHeatmap, key: string) => flat(data).find(c => c.key === key)

describe('heatmapDayKey', () => {
  it('keys a day by its UTC calendar date', () => {
    expect(heatmapDayKey(new Date('2026-03-05T23:30:00Z'))).toBe('2026-03-05')
  })
})

describe('buildHeatmapGrid', () => {
  const data = heatmap('2025-09-16T00:00:00Z', '2026-09-16T00:00:00Z')

  it('lays the year out as 53 columns of 7 days', () => {
    const weeks = buildHeatmapGrid(data)
    expect(weeks).toHaveLength(HEATMAP_WEEKS)
    expect(weeks.every(w => w.length === 7)).toBe(true)
  })

  it('starts every column on a Sunday and ends it on a Saturday', () => {
    for (const week of buildHeatmapGrid(data)) {
      expect(week[0].date.getUTCDay()).toBe(0)
      expect(week[6].date.getUTCDay()).toBe(6)
    }
  })

  it('runs oldest first with no gaps or repeats', () => {
    const keys = flat(data).map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect([...keys].sort()).toEqual(keys)
  })

  it('pads the final column out to the Saturday of the week containing `to`', () => {
    const end = flat(data).at(-1)!.date
    expect(end.getUTCDay()).toBe(6)
    expect(end.getTime()).toBeGreaterThanOrEqual(new Date('2026-09-16T00:00:00Z').getTime())
  })

  it('carries each reported day onto its cell', () => {
    const withActivity = heatmap('2025-09-16T00:00:00Z', '2026-09-16T00:00:00Z', [
      { date: '2026-03-05T00:00:00Z', reviews: 12, studyMinutes: 30 },
    ])

    const cell = cellFor(withActivity, '2026-03-05')!
    expect(cell.reviews).toBe(12)
    expect(cell.minutes).toBe(30)
    expect(cell.score).toBe(42)
  })

  it('accepts a reported day carrying a full timestamp, not just a date', () => {
    const withActivity = heatmap('2025-09-16T00:00:00Z', '2026-09-16T00:00:00Z', [
      { date: '2026-03-05T22:15:00Z', reviews: 3, studyMinutes: 0 },
    ])

    expect(cellFor(withActivity, '2026-03-05')!.reviews).toBe(3)
  })

  it('zeroes days the API did not report', () => {
    const cell = cellFor(data, '2026-03-05')!
    expect(cell.reviews).toBe(0)
    expect(cell.minutes).toBe(0)
    expect(cell.score).toBe(0)
  })

  it('marks padding outside the reported range so it can render blank', () => {
    const cells = flat(data)
    expect(cells.find(c => c.key === '2025-09-15')?.inRange ?? false).toBe(false)
    expect(cellFor(data, '2026-03-05')!.inRange).toBe(true)
    expect(cells.some(c => !c.inRange)).toBe(true)
  })

  it('treats both range endpoints as in range', () => {
    expect(cellFor(data, '2025-09-16')!.inRange).toBe(true)
    expect(cellFor(data, '2026-09-16')!.inRange).toBe(true)
  })

  it('does not shift a day when the machine is behind UTC', () => {
    // A reviewer in UTC-11 must still see 2026-03-05 on the 5th, not the 4th.
    const withActivity = heatmap('2025-09-16T00:00:00Z', '2026-09-16T00:00:00Z', [
      { date: '2026-03-05T00:00:00Z', reviews: 7, studyMinutes: 0 },
    ])

    const cell = cellFor(withActivity, '2026-03-05')!
    expect(heatmapDayKey(cell.date)).toBe('2026-03-05')
    expect(cell.reviews).toBe(7)
  })

  it('handles an empty report without collapsing the grid', () => {
    const weeks = buildHeatmapGrid(heatmap('2026-09-16T00:00:00Z', '2026-09-16T00:00:00Z'))
    expect(weeks).toHaveLength(HEATMAP_WEEKS)
    expect(weeks.flat().every(c => c.score === 0)).toBe(true)
  })
})
