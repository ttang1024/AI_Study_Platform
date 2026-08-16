import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isQuizOptionCorrect,
  getCorrectQuizOptionText,
  stripQuizOptionPrefix,
  shuffle,
} from '../quizAnswers'

describe('isQuizOptionCorrect', () => {
  it('returns false when option or answer is missing', () => {
    expect(isQuizOptionCorrect(null, 'answer')).toBe(false)
    expect(isQuizOptionCorrect('option', undefined)).toBe(false)
  })

  it('matches exact text, case/whitespace-insensitive', () => {
    expect(isQuizOptionCorrect('  Paris  ', 'paris')).toBe(true)
  })

  it('matches a bare option letter against a lettered option', () => {
    expect(isQuizOptionCorrect('B) Paris', 'B')).toBe(true)
    expect(isQuizOptionCorrect('B) Paris', 'C')).toBe(false)
  })

  it('matches option body against answer body after stripping prefixes', () => {
    expect(isQuizOptionCorrect('B) Paris', 'A) Paris')).toBe(true)
  })

  it('matches by semantic meaning ignoring punctuation/and/&', () => {
    expect(isQuizOptionCorrect('Reading & Writing', 'reading and writing')).toBe(true)
  })

  it('returns false for genuinely different options', () => {
    expect(isQuizOptionCorrect('London', 'Paris')).toBe(false)
  })
})

describe('getCorrectQuizOptionText', () => {
  it('returns the option text that matches the answer', () => {
    const options = ['A) London', 'B) Paris', 'C) Berlin']
    expect(getCorrectQuizOptionText(options, 'B')).toBe('B) Paris')
  })

  it('falls back to the raw answer when no option matches', () => {
    expect(getCorrectQuizOptionText(['A) London'], 'Madrid')).toBe('Madrid')
  })

  it('falls back to the raw answer when options is undefined', () => {
    expect(getCorrectQuizOptionText(undefined, 'Madrid')).toBe('Madrid')
  })
})

describe('stripQuizOptionPrefix', () => {
  it('strips an A)/B./C: style prefix', () => {
    expect(stripQuizOptionPrefix('A) Paris')).toBe('Paris')
    expect(stripQuizOptionPrefix('b. Paris')).toBe('Paris')
    expect(stripQuizOptionPrefix('C: Paris')).toBe('Paris')
  })

  it('leaves text without a prefix untouched', () => {
    expect(stripQuizOptionPrefix('Paris')).toBe('Paris')
  })
})

describe('shuffle', () => {
  afterEach(() => vi.restoreAllMocks())

  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4]
    const copy = [...input]
    shuffle(input)
    expect(input).toEqual(copy)
  })

  it('returns an array with the same elements', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect(result.sort()).toEqual(input.sort())
  })

  it('is deterministic for a fixed Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(shuffle([1, 2, 3, 4])).toEqual([2, 3, 4, 1])
  })
})
