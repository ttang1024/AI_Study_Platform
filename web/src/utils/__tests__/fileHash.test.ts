import { describe, expect, it, vi } from 'vitest'
import { calculateSha256 } from '../fileHash'

// jsdom does not implement File/Blob.arrayBuffer — polyfill it
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.readAsArrayBuffer(this)
    })
  }
}

const makeFile = (content: string, name = 'test.txt', type = 'text/plain') =>
  new File([content], name, { type })

describe('calculateSha256', () => {
  it('returns a 64-character hex string for a file', async () => {
    const file = makeFile('hello world')
    const hash = await calculateSha256(file)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same hash for identical content', async () => {
    const file1 = makeFile('deterministic content')
    const file2 = makeFile('deterministic content')
    const hash1 = await calculateSha256(file1)
    const hash2 = await calculateSha256(file2)
    expect(hash1).toBe(hash2)
  })

  it('returns different hashes for different content', async () => {
    const hash1 = await calculateSha256(makeFile('content A'))
    const hash2 = await calculateSha256(makeFile('content B'))
    expect(hash1).not.toBe(hash2)
  })

  it('returns null when crypto.subtle is unavailable', async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: undefined, writable: true, configurable: true })

    const hash = await calculateSha256(makeFile('hello'))
    expect(hash).toBeNull()

    Object.defineProperty(globalThis, 'crypto', { value: original, writable: true, configurable: true })
  })

  it('handles empty file content', async () => {
    const file = makeFile('')
    const hash = await calculateSha256(file)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
