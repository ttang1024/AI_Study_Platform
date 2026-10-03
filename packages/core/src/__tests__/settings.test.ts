import { describe, it, expect } from 'vitest'
import {
  DEFAULT_AI_SETTINGS,
  parseAiSettings,
  activeProviderOf,
  activeKeyOf,
  activeModelOf,
  DEFAULT_TTS_SETTINGS,
  parseTtsSettings,
  resolveVoice,
} from '../settings'

describe('AI settings', () => {
  it('parseAiSettings returns defaults for null/undefined/empty input', () => {
    expect(parseAiSettings(null)).toEqual(DEFAULT_AI_SETTINGS)
    expect(parseAiSettings(undefined)).toEqual(DEFAULT_AI_SETTINGS)
    expect(parseAiSettings('')).toEqual(DEFAULT_AI_SETTINGS)
  })

  it('parseAiSettings returns defaults for malformed JSON', () => {
    expect(parseAiSettings('{not json')).toEqual(DEFAULT_AI_SETTINGS)
  })

  it('parseAiSettings merges stored fields over the defaults', () => {
    const stored = JSON.stringify({ provider: 'openai', keys: { openai: 'sk-1' } })
    expect(parseAiSettings(stored)).toEqual({ provider: 'openai', keys: { openai: 'sk-1' }, models: {} })
  })

  it('activeProviderOf reads settings.provider', () => {
    expect(activeProviderOf({ provider: 'claude', keys: {}, models: {} })).toBe('claude')
  })

  it('activeKeyOf trims and returns the key for the active provider', () => {
    expect(activeKeyOf({ provider: 'openai', keys: { openai: '  sk-1  ' }, models: {} })).toBe('sk-1')
  })

  it('activeKeyOf treats a blank key as absent', () => {
    expect(activeKeyOf({ provider: 'openai', keys: { openai: '   ' }, models: {} })).toBeUndefined()
  })

  it('activeKeyOf returns undefined when no key is stored for the provider', () => {
    expect(activeKeyOf({ provider: 'openai', keys: {}, models: {} })).toBeUndefined()
  })

  it('activeModelOf uses the stored model when present', () => {
    expect(activeModelOf({ provider: 'openai', keys: {}, models: { openai: 'gpt-4o' } })).toBe('gpt-4o')
  })

  it('activeModelOf falls back to the provider default when absent or blank', () => {
    expect(activeModelOf({ provider: 'gemini', keys: {}, models: {} })).toBe('gemini-2.5-flash')
    expect(activeModelOf({ provider: 'gemini', keys: {}, models: { gemini: '   ' } })).toBe('gemini-2.5-flash')
  })
})

describe('TTS settings', () => {
  it('parseTtsSettings returns defaults for null/malformed input', () => {
    expect(parseTtsSettings(null)).toEqual(DEFAULT_TTS_SETTINGS)
    expect(parseTtsSettings('{bad')).toEqual(DEFAULT_TTS_SETTINGS)
  })

  it('parseTtsSettings merges stored fields over the defaults', () => {
    expect(parseTtsSettings(JSON.stringify({ voice: 'en-GB-RyanNeural' }))).toEqual({ voice: 'en-GB-RyanNeural' })
  })

  it('resolveVoice trims and returns the stored voice', () => {
    expect(resolveVoice({ voice: '  en-GB-RyanNeural  ' })).toBe('en-GB-RyanNeural')
  })

  it('resolveVoice falls back to the default when blank', () => {
    expect(resolveVoice({ voice: '   ' })).toBe(DEFAULT_TTS_SETTINGS.voice)
  })
})
