import { describe, it, expect } from 'vitest'
import { detectPodcastSource, isDirectAudioUrl, looksLikeRssFeedUrl, validatePodcastUrl } from '../podcastSources'

describe('detectPodcastSource', () => {
  it('detects a known platform from its domain', () => {
    expect(detectPodcastSource('https://podcasts.apple.com/us/podcast/x/id123')?.id).toBe('apple')
    expect(detectPodcastSource('https://overcast.fm/+abc')?.id).toBe('overcast')
  })

  it('detects a subdomain of a known domain', () => {
    expect(detectPodcastSource('https://open.podcastaddict.com/x')?.id).toBe('podcastaddict')
  })

  it('returns null for an unrecognized host', () => {
    expect(detectPodcastSource('https://example.com/ep1')).toBeNull()
  })

  it('returns null for a malformed URL', () => {
    expect(detectPodcastSource('not a url')).toBeNull()
  })

  it('returns null for a non-http(s) protocol', () => {
    expect(detectPodcastSource('ftp://overcast.fm/x')).toBeNull()
  })
})

describe('isDirectAudioUrl', () => {
  it('recognizes common audio extensions', () => {
    expect(isDirectAudioUrl('https://cdn.example.com/ep1.mp3')).toBe(true)
    expect(isDirectAudioUrl('https://cdn.example.com/ep1.m4a?token=abc')).toBe(true)
  })

  it('rejects a non-audio path', () => {
    expect(isDirectAudioUrl('https://example.com/episode-page')).toBe(false)
  })

  it('rejects a malformed URL', () => {
    expect(isDirectAudioUrl('not a url')).toBe(false)
  })
})

describe('looksLikeRssFeedUrl', () => {
  it('recognizes known feed-only hosts', () => {
    expect(looksLikeRssFeedUrl('https://feeds.buzzsprout.com/12345.rss')).toBe(true)
    expect(looksLikeRssFeedUrl('https://anchor.fm/s/abc/podcast/rss')).toBe(true)
  })

  it('recognizes an .rss/.xml path on any host', () => {
    expect(looksLikeRssFeedUrl('https://example.com/show.xml')).toBe(true)
  })

  it('recognizes a /feed or /rss path segment', () => {
    expect(looksLikeRssFeedUrl('https://example.com/podcast/feed')).toBe(true)
    expect(looksLikeRssFeedUrl('https://example.com/rss')).toBe(true)
  })

  it('returns false for a plain episode page', () => {
    expect(looksLikeRssFeedUrl('https://overcast.fm/+abc123')).toBe(false)
  })

  it('returns false for a malformed URL', () => {
    expect(looksLikeRssFeedUrl('not a url')).toBe(false)
  })
})

describe('validatePodcastUrl', () => {
  it('rejects a malformed URL with a generic message', () => {
    expect(validatePodcastUrl('not a url')).toMatch(/valid episode link/)
  })

  it('rejects an Apple Podcasts show link (no ?i=)', () => {
    expect(validatePodcastUrl('https://podcasts.apple.com/us/podcast/show/id123')).toMatch(/Apple Podcasts link is for a show/)
  })

  it('accepts an Apple Podcasts episode link (has ?i=)', () => {
    expect(validatePodcastUrl('https://podcasts.apple.com/us/podcast/show/id123?i=1000')).toBeNull()
  })

  it('accepts any other well-formed http(s) URL', () => {
    expect(validatePodcastUrl('https://overcast.fm/+abc123')).toBeNull()
  })
})
