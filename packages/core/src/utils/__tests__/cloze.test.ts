import { describe, it, expect } from 'vitest'
import { hasClozeMarkers, clozeQuestionText, clozeAnswerText } from '../cloze'

describe('cloze', () => {
  describe('hasClozeMarkers', () => {
    it('detects {{term}} markers', () => {
      expect(hasClozeMarkers('The capital is {{Paris}}.')).toBe(true)
    })

    it('returns false when there are no markers', () => {
      expect(hasClozeMarkers('Plain text with no braces')).toBe(false)
    })
  })

  describe('clozeQuestionText', () => {
    it('blanks out every marker', () => {
      expect(clozeQuestionText('{{A}} and {{B}} are both true')).toBe('_____ and _____ are both true')
    })

    it('leaves text without markers untouched', () => {
      expect(clozeQuestionText('no markers here')).toBe('no markers here')
    })
  })

  describe('clozeAnswerText', () => {
    it('reveals the term inline', () => {
      expect(clozeAnswerText('{{A}} and {{B}} are both true')).toBe('A and B are both true')
    })
  })
})
