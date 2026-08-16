import { describe, it, expect } from 'vitest'
import { formatTimecode, formatCountdown, formatBytes, toLocalDateKey } from '../format'

describe('formatTimecode', () => {
  it('formats seconds under an hour as m:ss without padding by default', () => {
    expect(formatTimecode(65)).toBe('1:05')
  })

  it('pads minutes when requested', () => {
    expect(formatTimecode(65, { padMinutes: true })).toBe('01:05')
  })

  it('formats seconds over an hour as h:mm:ss', () => {
    expect(formatTimecode(3725)).toBe('1:02:05')
  })

  it('clamps negative input to zero', () => {
    expect(formatTimecode(-10)).toBe('0:00')
  })

  it('floors fractional seconds', () => {
    expect(formatTimecode(65.9)).toBe('1:05')
  })
})

describe('formatCountdown', () => {
  it('formats milliseconds as m:ss', () => {
    expect(formatCountdown(90000)).toBe('1:30')
  })

  it('clamps negative input to zero', () => {
    expect(formatCountdown(-500)).toBe('0:00')
  })
})

describe('formatBytes', () => {
  it('returns empty string for absent or zero input', () => {
    expect(formatBytes(null)).toBe('')
    expect(formatBytes(undefined)).toBe('')
    expect(formatBytes(0)).toBe('')
  })

  it('formats sub-MB sizes in KB, rounded, min 1', () => {
    expect(formatBytes(500)).toBe('1 KB')
    expect(formatBytes(2048)).toBe('2 KB')
  })

  it('formats MB-and-above sizes with one decimal', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })
})

describe('toLocalDateKey', () => {
  it('formats an ISO date as YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 7, 2) // Aug 2 2026, local
    expect(toLocalDateKey(d.toISOString())).toBe(toLocalDateKeyExpected(d))
  })
})

function toLocalDateKeyExpected(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
