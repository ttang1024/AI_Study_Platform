import { describe, it, expect } from 'vitest'
import { normalizeSummaryText } from '../summary'

describe('normalizeSummaryText', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(normalizeSummaryText(null)).toBeNull()
    expect(normalizeSummaryText(undefined)).toBeNull()
    expect(normalizeSummaryText('')).toBeNull()
  })

  it('passes through raw markdown that is not JSON', () => {
    expect(normalizeSummaryText('# Heading\n\nSome text')).toBe('# Heading\n\nSome text')
  })

  it('unwraps a legacy JSON blob with summary + keyPoints', () => {
    const raw = JSON.stringify({ summary: 'Overview text', keyPoints: ['Point one', 'Point two'] })
    const result = normalizeSummaryText(raw)
    expect(result).toContain('Overview text')
    expect(result).toContain('**Key Points:**')
    expect(result).toContain('- Point one')
    expect(result).toContain('- Point two')
  })

  it('unwraps a legacy JSON blob with no keyPoints', () => {
    const raw = JSON.stringify({ summary: 'Overview only' })
    expect(normalizeSummaryText(raw)).toBe('Overview only')
  })

  it('falls back to the raw string when JSON parses but summary is empty', () => {
    const raw = JSON.stringify({ summary: '' })
    expect(normalizeSummaryText(raw)).toBe(raw)
  })
})
