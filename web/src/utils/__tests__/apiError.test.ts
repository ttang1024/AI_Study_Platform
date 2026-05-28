import { describe, expect, it } from 'vitest'
import { getApiErrorCode, getApiErrorMessage } from '../apiError'

describe('getApiErrorCode', () => {
  it('returns errorCode from response.data.errorCode', () => {
    const err = { response: { data: { errorCode: 'NOT_FOUND' } } }
    expect(getApiErrorCode(err)).toBe('NOT_FOUND')
  })

  it('returns ErrorCode (PascalCase) from response.data.ErrorCode', () => {
    const err = { response: { data: { ErrorCode: 'UNAUTHORIZED' } } }
    expect(getApiErrorCode(err)).toBe('UNAUTHORIZED')
  })

  it('prefers errorCode over ErrorCode', () => {
    const err = { response: { data: { errorCode: 'FIRST', ErrorCode: 'SECOND' } } }
    expect(getApiErrorCode(err)).toBe('FIRST')
  })

  it('falls back to top-level errorCode when no response', () => {
    const err = { errorCode: 'TOP_LEVEL' }
    expect(getApiErrorCode(err)).toBe('TOP_LEVEL')
  })

  it('falls back to response.data.message when no code fields', () => {
    const err = { response: { data: { message: 'Something went wrong' } } }
    expect(getApiErrorCode(err)).toBe('Something went wrong')
  })

  it('falls back to err.message when no response', () => {
    const err = { message: 'Network Error' }
    expect(getApiErrorCode(err)).toBe('Network Error')
  })

  it('returns custom fallback when nothing is found', () => {
    expect(getApiErrorCode({}, 'MY_FALLBACK')).toBe('MY_FALLBACK')
  })

  it('returns default fallback REQUEST_FAILED when nothing is found', () => {
    expect(getApiErrorCode(null)).toBe('REQUEST_FAILED')
  })

  it('trims whitespace from code', () => {
    const err = { response: { data: { errorCode: '  TRIMMED  ' } } }
    expect(getApiErrorCode(err)).toBe('TRIMMED')
  })

  it('ignores empty string code and moves to next fallback', () => {
    const err = { response: { data: { errorCode: '   ', message: 'Fallback message' } } }
    expect(getApiErrorCode(err)).toBe('Fallback message')
  })
})

describe('getApiErrorMessage', () => {
  it('returns message from response.data.message', () => {
    const err = { response: { data: { message: 'Document not found.' } } }
    expect(getApiErrorMessage(err)).toBe('Document not found.')
  })

  it('falls back to err.message when no response', () => {
    const err = { message: 'Network error' }
    expect(getApiErrorMessage(err)).toBe('Network error')
  })

  it('returns first string from errors array when no message', () => {
    const err = { response: { data: { errors: ['Validation failed', 'Another error'] } } }
    expect(getApiErrorMessage(err)).toBe('Validation failed')
  })

  it('skips non-string entries in errors array', () => {
    const err = { response: { data: { errors: [null, '  ', 'Real error'] } } }
    expect(getApiErrorMessage(err)).toBe('Real error')
  })

  it('returns default fallback when nothing is found', () => {
    expect(getApiErrorMessage(null)).toBe('Request failed.')
  })

  it('returns custom fallback when nothing is found', () => {
    expect(getApiErrorMessage({}, 'Custom fallback.')).toBe('Custom fallback.')
  })

  it('trims whitespace from message', () => {
    const err = { response: { data: { message: '  Trimmed message.  ' } } }
    expect(getApiErrorMessage(err)).toBe('Trimmed message.')
  })
})
