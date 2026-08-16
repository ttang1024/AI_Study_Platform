import { describe, it, expect } from 'vitest'
import { ACHIEVEMENTS, type AchievementProgress } from '../achievements'

const progress = (overrides: Partial<AchievementProgress> = {}): AchievementProgress => ({
  totalFlashcards: 0,
  totalQuizSubmissions: 0,
  totalNotes: 0,
  totalDocuments: 0,
  achievements: { perfectQuizzes: 0, averageQuizScore: 0, flashcardsMastered: 0 },
  ...overrides,
})

const find = (id: string) => {
  const a = ACHIEVEMENTS.find((x) => x.id === id)
  if (!a) throw new Error(`achievement ${id} not found`)
  return a
}

describe('ACHIEVEMENTS', () => {
  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('first_flashcard unlocks at exactly 1 flashcard', () => {
    const a = find('first_flashcard')
    expect(a.condition(progress({ totalFlashcards: 0 }))).toBe(false)
    expect(a.condition(progress({ totalFlashcards: 1 }))).toBe(true)
  })

  it('flashcard_50 requires 50 flashcards', () => {
    const a = find('flashcard_50')
    expect(a.condition(progress({ totalFlashcards: 49 }))).toBe(false)
    expect(a.condition(progress({ totalFlashcards: 50 }))).toBe(true)
  })

  it('flashcard_mastered_5 reads the nested achievements counter', () => {
    const a = find('flashcard_mastered_5')
    expect(a.condition(progress({ achievements: { perfectQuizzes: 0, averageQuizScore: 0, flashcardsMastered: 4 } }))).toBe(false)
    expect(a.condition(progress({ achievements: { perfectQuizzes: 0, averageQuizScore: 0, flashcardsMastered: 5 } }))).toBe(true)
  })

  it('avg_score_80 requires both a high average AND a 3-quiz minimum sample', () => {
    const a = find('avg_score_80')
    expect(a.condition(progress({ totalQuizSubmissions: 1, achievements: { perfectQuizzes: 0, averageQuizScore: 100, flashcardsMastered: 0 } }))).toBe(false)
    expect(a.condition(progress({ totalQuizSubmissions: 3, achievements: { perfectQuizzes: 0, averageQuizScore: 79, flashcardsMastered: 0 } }))).toBe(false)
    expect(a.condition(progress({ totalQuizSubmissions: 3, achievements: { perfectQuizzes: 0, averageQuizScore: 80, flashcardsMastered: 0 } }))).toBe(true)
  })

  it('doc_5 requires 5 documents', () => {
    const a = find('doc_5')
    expect(a.condition(progress({ totalDocuments: 4 }))).toBe(false)
    expect(a.condition(progress({ totalDocuments: 5 }))).toBe(true)
  })

  it('every achievement condition runs without throwing on a zeroed progress object', () => {
    const zero = progress()
    for (const a of ACHIEVEMENTS) {
      expect(() => a.condition(zero)).not.toThrow()
    }
  })
})
