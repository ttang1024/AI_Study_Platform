import { describe, it, expect } from 'vitest'
import { buildAiHeaders, AI_PROVIDERS, AI_PROVIDER_IDS, DEFAULT_MODELS } from '../ai'

describe('buildAiHeaders', () => {
  it('builds provider/model headers and omits the key header when absent', () => {
    expect(buildAiHeaders({ provider: 'gemini', model: 'gemini-2.5-flash' })).toEqual({
      'X-AI-Provider': 'gemini',
      'X-AI-Model': 'gemini-2.5-flash',
    })
  })

  it('includes the key header when a key is given', () => {
    expect(buildAiHeaders({ provider: 'openai', model: 'gpt-4o-mini', key: 'sk-1' })).toEqual({
      'X-AI-Provider': 'openai',
      'X-AI-Model': 'gpt-4o-mini',
      'X-AI-Key': 'sk-1',
    })
  })

  it('omits the key header for an empty string key', () => {
    const headers = buildAiHeaders({ provider: 'openai', model: 'gpt-4o-mini', key: '' })
    expect(headers['X-AI-Key']).toBeUndefined()
  })
})

describe('AI_PROVIDERS registry', () => {
  it('has a default model for every registered provider', () => {
    for (const id of AI_PROVIDER_IDS) {
      expect(DEFAULT_MODELS[id]).toBeTruthy()
    }
  })

  it('AI_PROVIDER_IDS matches the ids in AI_PROVIDERS', () => {
    expect(AI_PROVIDER_IDS).toEqual(AI_PROVIDERS.map((p) => p.id))
  })
})
