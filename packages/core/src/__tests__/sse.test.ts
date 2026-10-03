import { describe, it, expect, vi } from 'vitest'
import { makeStreamError, extractStreamErrorCode, readSseData, readSseTextStream, STREAM_ERROR_MESSAGE } from '../sse'
import type { ByteStream } from '../sse'

function streamFromChunks(chunks: string[]): ByteStream {
  const encoder = new TextEncoder()
  let i = 0
  return {
    getReader: () => ({
      read: async () => {
        if (i >= chunks.length) return { done: true, value: undefined }
        const value = encoder.encode(chunks[i])
        i++
        return { done: false, value }
      },
    }),
  }
}

describe('makeStreamError', () => {
  it('uses the default message when no errorCode is given', () => {
    const err = makeStreamError()
    expect(err.message).toBe(STREAM_ERROR_MESSAGE)
    expect(err.errorCode).toBeUndefined()
  })

  it('uses the errorCode as the message when given', () => {
    const err = makeStreamError('RATE_LIMITED')
    expect(err.message).toBe('RATE_LIMITED')
    expect(err.errorCode).toBe('RATE_LIMITED')
  })
})

describe('extractStreamErrorCode', () => {
  it('reads errorCode from a JSON body', async () => {
    const response = { json: async () => ({ errorCode: 'RATE_LIMITED' }) }
    expect(await extractStreamErrorCode(response)).toBe('RATE_LIMITED')
  })

  it('reads PascalCase ErrorCode as a fallback', async () => {
    const response = { json: async () => ({ ErrorCode: 'BAD_KEY' }) }
    expect(await extractStreamErrorCode(response)).toBe('BAD_KEY')
  })

  it('returns undefined when the body has no code', async () => {
    const response = { json: async () => ({ message: 'oops' }) }
    expect(await extractStreamErrorCode(response)).toBeUndefined()
  })

  it('returns undefined when the body is not valid JSON', async () => {
    const response = { json: async () => { throw new Error('not json') } }
    expect(await extractStreamErrorCode(response)).toBeUndefined()
  })

  it('returns undefined for a blank code', async () => {
    const response = { json: async () => ({ errorCode: '   ' }) }
    expect(await extractStreamErrorCode(response)).toBeUndefined()
  })
})

describe('readSseData', () => {
  it('yields the trimmed payload of each data: line', async () => {
    const stream = streamFromChunks(['data: "hello"\n\n', 'data: "world"\n\n'])
    const results: string[] = []
    for await (const chunk of readSseData(stream)) results.push(chunk)
    expect(results).toEqual(['"hello"', '"world"'])
  })

  it('ignores non-data lines', async () => {
    const stream = streamFromChunks([': comment\nevent: message\ndata: "x"\n\n'])
    const results: string[] = []
    for await (const chunk of readSseData(stream)) results.push(chunk)
    expect(results).toEqual(['"x"'])
  })

  it('buffers a data: line split across multiple reads', async () => {
    const stream = streamFromChunks(['data: "he', 'llo"\n\n'])
    const results: string[] = []
    for await (const chunk of readSseData(stream)) results.push(chunk)
    expect(results).toEqual(['"hello"'])
  })

  it('yields the literal [DONE] payload', async () => {
    const stream = streamFromChunks(['data: [DONE]\n\n'])
    const results: string[] = []
    for await (const chunk of readSseData(stream)) results.push(chunk)
    expect(results).toEqual(['[DONE]'])
  })
})

describe('readSseTextStream', () => {
  it('invokes onChunk with each decoded JSON string and stops at [DONE]', async () => {
    const stream = streamFromChunks(['data: "hello"\n\n', 'data: "world"\n\n', 'data: [DONE]\n\n', 'data: "never seen"\n\n'])
    const onChunk = vi.fn()
    await readSseTextStream(stream, onChunk)
    expect(onChunk).toHaveBeenCalledTimes(2)
    expect(onChunk).toHaveBeenNthCalledWith(1, 'hello')
    expect(onChunk).toHaveBeenNthCalledWith(2, 'world')
  })

  it('throws a StreamError on an [ERROR] chunk', async () => {
    const stream = streamFromChunks(['data: "[ERROR] RATE_LIMITED"\n\n'])
    const onChunk = vi.fn()
    await expect(readSseTextStream(stream, onChunk)).rejects.toMatchObject({ errorCode: 'RATE_LIMITED' })
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('ignores malformed (non-JSON) data frames', async () => {
    const stream = streamFromChunks(['data: not json\n\n', 'data: "valid"\n\n'])
    const onChunk = vi.fn()
    await readSseTextStream(stream, onChunk)
    expect(onChunk).toHaveBeenCalledTimes(1)
    expect(onChunk).toHaveBeenCalledWith('valid')
  })

  it('ignores blank data frames', async () => {
    const stream = streamFromChunks(['data: \n\n', 'data: "valid"\n\n'])
    const onChunk = vi.fn()
    await readSseTextStream(stream, onChunk)
    expect(onChunk).toHaveBeenCalledTimes(1)
  })

  it('resolves without calling onChunk again when the stream ends without [DONE]', async () => {
    const stream = streamFromChunks(['data: "only"\n\n'])
    const onChunk = vi.fn()
    await readSseTextStream(stream, onChunk)
    expect(onChunk).toHaveBeenCalledTimes(1)
  })
})
