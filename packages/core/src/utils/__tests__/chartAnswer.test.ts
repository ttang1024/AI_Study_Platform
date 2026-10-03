import { describe, it, expect } from 'vitest'
import { isChartAnswer } from '../chartAnswer'

describe('isChartAnswer', () => {
  it('recognises a chart spec with labels and datasets', () => {
    expect(isChartAnswer('{"labels":["a"],"datasets":[{"data":[1]}]}')).toBe(true)
  })

  it('rejects plain prose, other JSON, and malformed JSON', () => {
    expect(isChartAnswer('The mitochondria')).toBe(false)
    expect(isChartAnswer('{"labels":["a"]}')).toBe(false)
    expect(isChartAnswer('{not json')).toBe(false)
  })
})
