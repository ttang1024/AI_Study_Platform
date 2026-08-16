import { describe, it, expect } from 'vitest'
import { validatePassword } from '../validatePassword'

describe('validatePassword', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('Ab1!')).toBe(false)
  })

  it('rejects passwords longer than 20 characters', () => {
    expect(validatePassword('Aa1' + '!'.repeat(20))).toBe(false)
  })

  it('rejects passwords with fewer than 3 character types', () => {
    expect(validatePassword('alllowercase')).toBe(false)
    expect(validatePassword('ALLUPPERCASE')).toBe(false)
    expect(validatePassword('12345678')).toBe(false)
    expect(validatePassword('lowerUPPER')).toBe(false)
  })

  it('accepts passwords with exactly 3 character types', () => {
    expect(validatePassword('lowerUPPER1')).toBe(true)
    expect(validatePassword('lower1!!!!')).toBe(true)
  })

  it('accepts passwords with all 4 character types', () => {
    expect(validatePassword('Lower1!ok')).toBe(true)
  })

  it('accepts boundary lengths 8 and 20', () => {
    expect(validatePassword('Abcdefg1')).toBe(true)
    expect(validatePassword('Abcdefghij1234567890'.slice(0, 20))).toBe(true)
  })
})
