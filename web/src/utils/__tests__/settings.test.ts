import { describe, expect, it } from 'vitest'
import { DEFAULT_MODELS } from '@core/ai'
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_TTS_SETTINGS,
  activeKeyOf,
  activeModelOf,
  activeProviderOf,
  parseAiSettings,
  parseTtsSettings,
  resolveVoice,
} from '@core/settings'

// Shared by web (localStorage) and rn (expo-secure-store); only the read/write differs, so these
// cover the derivations both platforms now delegate to.

describe('parseAiSettings', () => {
  it('falls back to defaults for absent storage', () => {
    expect(parseAiSettings(null)).toEqual(DEFAULT_AI_SETTINGS)
    expect(parseAiSettings(undefined)).toEqual(DEFAULT_AI_SETTINGS)
    expect(parseAiSettings('')).toEqual(DEFAULT_AI_SETTINGS)
  })

  it('falls back to defaults rather than throwing on a corrupt blob', () => {
    expect(parseAiSettings('{not json')).toEqual(DEFAULT_AI_SETTINGS)
  })

  it('fills in missing fields from defaults', () => {
    expect(parseAiSettings('{"provider":"openai"}')).toEqual({ ...DEFAULT_AI_SETTINGS, provider: 'openai' })
  })

  it('does not hand back the shared defaults object', () => {
    const parsed = parseAiSettings(null)
    parsed.provider = 'openai'
    expect(DEFAULT_AI_SETTINGS.provider).toBe('gemini')
  })
})

describe('active* derivations', () => {
  it('reads the key for the active provider', () => {
    const settings = parseAiSettings('{"provider":"openai","keys":{"openai":"sk-abc","gemini":"AIza"}}')
    expect(activeKeyOf(settings)).toBe('sk-abc')
    expect(activeProviderOf(settings)).toBe('openai')
  })

  // A cleared input leaves an empty string behind; sending it as an X-AI-* header would look
  // like a real credential to the server instead of "no key configured".
  it('treats a blank or whitespace key as absent', () => {
    expect(activeKeyOf(parseAiSettings('{"keys":{"gemini":""}}'))).toBeUndefined()
    expect(activeKeyOf(parseAiSettings('{"keys":{"gemini":"   "}}'))).toBeUndefined()
  })

  it('trims a configured key', () => {
    expect(activeKeyOf(parseAiSettings('{"keys":{"gemini":"  AIza  "}}'))).toBe('AIza')
  })

  it('falls back to the provider default model when none is set', () => {
    expect(activeModelOf(parseAiSettings(null))).toBe(DEFAULT_MODELS.gemini)
    expect(activeModelOf(parseAiSettings('{"models":{"gemini":"  "}}'))).toBe(DEFAULT_MODELS.gemini)
  })

  it('uses the configured model when set', () => {
    expect(activeModelOf(parseAiSettings('{"models":{"gemini":"gemini-2.5-pro"}}'))).toBe('gemini-2.5-pro')
  })
})

describe('tts settings', () => {
  it('falls back to the default voice', () => {
    expect(parseTtsSettings(null)).toEqual(DEFAULT_TTS_SETTINGS)
    expect(parseTtsSettings('{oops')).toEqual(DEFAULT_TTS_SETTINGS)
    expect(resolveVoice({ voice: '   ' })).toBe(DEFAULT_TTS_SETTINGS.voice)
  })

  it('keeps a configured voice', () => {
    expect(resolveVoice(parseTtsSettings('{"voice":"en-GB-SoniaNeural"}'))).toBe('en-GB-SoniaNeural')
  })
})
