import { describe, it, expect } from 'vitest';
import { getDocumentKind, getDocumentRoute } from '../documentRoute';

const doc = (type: string, originalUrl?: string) =>
  ({ type, originalUrl } as Parameters<typeof getDocumentKind>[0]);

describe('getDocumentKind', () => {
  it('treats uploaded audio as audio', () => {
    expect(getDocumentKind(doc('audio'))).toBe('audio');
  });

  it('treats a podcast episode as audio', () => {
    expect(getDocumentKind(doc('podcast'))).toBe('audio');
  });

  // The regression: a podcast pulled from a feed carries an originalUrl like a clipped article does.
  // Testing the url first sends the episode to the article viewer, which has no player.
  it('keeps a podcast with an originalUrl as audio, not an article', () => {
    expect(getDocumentKind(doc('podcast', 'https://example.com/ep/1'))).toBe('audio');
    expect(getDocumentKind(doc('audio', 'https://example.com/ep/2'))).toBe('audio');
  });

  it('treats a clipped web page as an article', () => {
    expect(getDocumentKind(doc('md', 'https://example.com/post'))).toBe('article');
  });

  it('treats an uploaded file as a document', () => {
    expect(getDocumentKind(doc('pdf'))).toBe('document');
  });

  it('falls back to document when the doc has not loaded yet', () => {
    expect(getDocumentKind(undefined)).toBe('document');
  });
});

describe('getDocumentRoute', () => {
  it.each([
    [doc('podcast', 'https://example.com/ep/1'), '/audio/abc'],
    [doc('audio'), '/audio/abc'],
    [doc('md', 'https://example.com/post'), '/articles/abc'],
    [doc('pdf'), '/documents/abc'],
    [undefined, '/documents/abc'],
  ])('routes %o to %s', (d, expected) => {
    expect(getDocumentRoute('abc', d)).toBe(expected);
  });
});
