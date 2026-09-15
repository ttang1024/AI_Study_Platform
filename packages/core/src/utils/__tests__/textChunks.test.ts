import { describe, it, expect } from 'vitest'
import { splitIntoSpeechChunks } from '../textChunks'

const MAX = 5000
const sentence = (n: number) => `${'a'.repeat(n - 2)}. `

describe('splitIntoSpeechChunks', () => {
  it('leaves text that already fits in one request alone', () => {
    expect(splitIntoSpeechChunks('Short narration.')).toEqual(['Short narration.'])
  })

  it('passes an empty string straight through', () => {
    expect(splitIntoSpeechChunks('')).toEqual([''])
  })

  it('keeps text exactly at the limit as a single chunk', () => {
    const text = 'a'.repeat(MAX)
    expect(splitIntoSpeechChunks(text)).toEqual([text])
  })

  it('splits text over the limit', () => {
    const chunks = splitIntoSpeechChunks('a'.repeat(MAX + 1))
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('never emits a chunk over the limit', () => {
    const text = `${sentence(400).repeat(40)}tail`
    for (const chunk of splitIntoSpeechChunks(text)) {
      expect(chunk.length).toBeLessThanOrEqual(MAX)
    }
  })

  it('preserves the text when the chunks are rejoined', () => {
    const text = `${sentence(400).repeat(40)}tail`
    const rejoined = splitIntoSpeechChunks(text).join(' ').replace(/\s+/g, ' ').trim()
    expect(rejoined).toBe(text.replace(/\s+/g, ' ').trim())
  })

  it('cuts at a sentence boundary so a chunk does not clip mid-sentence', () => {
    // Long enough to force a split, built entirely from whole sentences.
    const chunks = splitIntoSpeechChunks(sentence(500).repeat(15))
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].endsWith('.')).toBe(true)
  })

  it.each(['!', '?'])('treats "%s" as a sentence boundary too', mark => {
    const text = `${'b'.repeat(4990)}${mark} ${'c'.repeat(3000)}`
    const [first] = splitIntoSpeechChunks(text)
    expect(first.endsWith(mark)).toBe(true)
  })

  it('cuts at a newline-terminated sentence', () => {
    const text = `${'b'.repeat(4990)}.\n${'c'.repeat(3000)}`
    expect(splitIntoSpeechChunks(text)[0].endsWith('.')).toBe(true)
  })

  it('falls back to a hard cut when a single sentence exceeds the limit', () => {
    const text = 'a'.repeat(MAX + 500)
    const chunks = splitIntoSpeechChunks(text)
    expect(chunks[0]).toHaveLength(MAX)
    expect(chunks[1]).toHaveLength(500)
  })

  it('trims the whitespace around each chunk', () => {
    for (const chunk of splitIntoSpeechChunks(sentence(500).repeat(15))) {
      expect(chunk).toBe(chunk.trim())
    }
  })

  it('emits no empty chunks', () => {
    const chunks = splitIntoSpeechChunks(`${sentence(500).repeat(15)}   `)
    expect(chunks.every(c => c.length > 0)).toBe(true)
  })
})
