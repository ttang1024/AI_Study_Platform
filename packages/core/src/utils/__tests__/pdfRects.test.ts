import { describe, it, expect } from 'vitest'
import { parseRects } from '../pdfRects'

describe('parseRects', () => {
  it('parses a valid JSON array of rects', () => {
    const rects = [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }]
    expect(parseRects(JSON.stringify(rects))).toEqual(rects)
  })

  it('returns an empty array when JSON is malformed', () => {
    expect(parseRects('{not json')).toEqual([])
  })

  it('returns an empty array when JSON parses but is not an array', () => {
    expect(parseRects(JSON.stringify({ x: 1 }))).toEqual([])
  })

  it('returns an empty array for an empty JSON array', () => {
    expect(parseRects('[]')).toEqual([])
  })
})
