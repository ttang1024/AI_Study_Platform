import { describe, it, expect } from 'vitest'
import { getApiErrorCode, getApiErrorMessage } from '../apiError'

describe('getApiErrorCode', () => {
  it('reads errorCode from response.data', () => {
    const err = { response: { data: { errorCode: 'NOT_FOUND' } } }
    expect(getApiErrorCode(err)).toBe('NOT_FOUND')
  })

  it('falls back to PascalCase ErrorCode', () => {
    const err = { response: { data: { ErrorCode: 'CONFLICT' } } }
    expect(getApiErrorCode(err)).toBe('CONFLICT')
  })

  it('falls back to a top-level errorCode', () => {
    const err = { errorCode: 'TOP_LEVEL' }
    expect(getApiErrorCode(err)).toBe('TOP_LEVEL')
  })

  it('falls back to a message when no code is present', () => {
    const err = { response: { data: { message: 'Something broke' } } }
    expect(getApiErrorCode(err)).toBe('Something broke')
  })

  it('returns the default fallback when nothing is present', () => {
    expect(getApiErrorCode({})).toBe('REQUEST_FAILED')
  })

  it('accepts a custom fallback', () => {
    expect(getApiErrorCode({}, 'CUSTOM')).toBe('CUSTOM')
  })

  it('ignores a blank/whitespace-only code', () => {
    const err = { response: { data: { errorCode: '   ' } } }
    expect(getApiErrorCode(err)).toBe('REQUEST_FAILED')
  })
})

describe('getApiErrorMessage', () => {
  it('reads message from response.data', () => {
    const err = { response: { data: { message: 'Bad input' } } }
    expect(getApiErrorMessage(err)).toBe('Bad input')
  })

  it('falls back to a top-level message', () => {
    const err = { message: 'Network error' }
    expect(getApiErrorMessage(err)).toBe('Network error')
  })

  it('falls back to the first string in an errors array', () => {
    const err = { response: { data: { errors: ['Field required', 'Other'] } } }
    expect(getApiErrorMessage(err)).toBe('Field required')
  })

  it('returns the default fallback when nothing is present', () => {
    expect(getApiErrorMessage({})).toBe('Request failed.')
  })

  it('accepts a custom fallback', () => {
    expect(getApiErrorMessage({}, 'Custom failure')).toBe('Custom failure')
  })
})
