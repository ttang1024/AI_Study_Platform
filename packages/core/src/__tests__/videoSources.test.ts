import { describe, it, expect } from 'vitest'
import {
  isExternalVideoSource,
  detectVideoSource,
  parseYouTubeId,
  parseBilibiliVideo,
  parseBilibiliKey,
  parseUrlVideoId,
  parseVimeoId,
  parseTedSlug,
  parseDailymotionId,
  parseFacebookVideoId,
  parseInstagramCode,
  parseTweetId,
  parseRedditPostId,
  parseTikTokId,
  parseLinkedInActivityId,
  parseExternalVideoId,
  buildExternalEmbedUrl,
  buildBilibiliEmbedUrl,
  buildYouTubeEmbedUrl,
  buildEmbedUrl,
} from '../videoSources'

describe('isExternalVideoSource', () => {
  it('recognizes every registered external source', () => {
    expect(isExternalVideoSource('vimeo')).toBe(true)
    expect(isExternalVideoSource('tiktok')).toBe(true)
  })

  it('rejects youtube/bilibili/upload and unknown strings', () => {
    expect(isExternalVideoSource('youtube')).toBe(false)
    expect(isExternalVideoSource('bilibili')).toBe(false)
    expect(isExternalVideoSource('upload')).toBe(false)
    expect(isExternalVideoSource('unknown')).toBe(false)
  })

  it('rejects null/undefined', () => {
    expect(isExternalVideoSource(null)).toBe(false)
    expect(isExternalVideoSource(undefined)).toBe(false)
  })
})

describe('detectVideoSource', () => {
  it('detects youtube from both domains', () => {
    expect(detectVideoSource('https://www.youtube.com/watch?v=abc')).toBe('youtube')
    expect(detectVideoSource('https://youtu.be/abc')).toBe('youtube')
  })

  it('detects every registered external source', () => {
    expect(detectVideoSource('https://vimeo.com/12345')).toBe('vimeo')
    expect(detectVideoSource('https://www.ted.com/talks/x')).toBe('ted')
    expect(detectVideoSource('https://dai.ly/x')).toBe('dailymotion')
    expect(detectVideoSource('https://fb.watch/x')).toBe('facebook')
    expect(detectVideoSource('https://www.instagram.com/reel/x')).toBe('instagram')
    expect(detectVideoSource('https://x.com/u/status/1')).toBe('twitter')
    expect(detectVideoSource('https://redd.it/abc')).toBe('reddit')
    expect(detectVideoSource('https://www.linkedin.com/feed/update/x')).toBe('linkedin')
    expect(detectVideoSource('https://www.tiktok.com/@u/video/1')).toBe('tiktok')
  })

  it('tolerates a URL with no protocol', () => {
    expect(detectVideoSource('youtube.com/watch?v=abc')).toBe('youtube')
  })

  it('returns null for an unrecognized host', () => {
    expect(detectVideoSource('https://example.com/video')).toBeNull()
  })

  it('returns null for a malformed URL', () => {
    expect(detectVideoSource('not a url at all')).toBeNull()
  })
})

describe('parseYouTubeId', () => {
  it('parses ?v=, youtu.be, shorts, and embed forms', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=abc123')).toBe('abc123')
    expect(parseYouTubeId('https://youtu.be/abc123')).toBe('abc123')
    expect(parseYouTubeId('https://www.youtube.com/shorts/abc123')).toBe('abc123')
    expect(parseYouTubeId('https://www.youtube.com/embed/abc123')).toBe('abc123')
  })

  it('returns null when no id is found', () => {
    expect(parseYouTubeId('https://www.youtube.com/')).toBeNull()
  })
})

describe('parseBilibiliVideo / parseBilibiliKey', () => {
  it('parses a page-1 video with no key suffix', () => {
    expect(parseBilibiliVideo('https://www.bilibili.com/video/BV1xx411c7abc')).toEqual({
      bvid: 'BV1xx411c7abc',
      page: 1,
      key: 'BV1xx411c7abc',
    })
  })

  it('parses an explicit page via the query param', () => {
    expect(parseBilibiliVideo('https://www.bilibili.com/video/BV1xx411c7abc?p=3')).toEqual({
      bvid: 'BV1xx411c7abc',
      page: 3,
      key: 'BV1xx411c7abc:p3',
    })
  })

  it('falls back to regex parsing for a non-URL fragment', () => {
    expect(parseBilibiliVideo('bilibili.com/video/BV1xx411c7abc?p=2')).toEqual({
      bvid: 'BV1xx411c7abc',
      page: 2,
      key: 'BV1xx411c7abc:p2',
    })
  })

  it('returns null when there is no BV id', () => {
    expect(parseBilibiliVideo('https://www.bilibili.com/')).toBeNull()
  })

  it('parseBilibiliKey unwraps to just the key', () => {
    expect(parseBilibiliKey('https://www.bilibili.com/video/BV1xx411c7abc?p=2')).toBe('BV1xx411c7abc:p2')
    expect(parseBilibiliKey('https://www.bilibili.com/')).toBeNull()
  })
})

describe('parseUrlVideoId dispatch', () => {
  it('dispatches to the youtube/bilibili/external parsers', () => {
    expect(parseUrlVideoId('youtube', 'https://youtu.be/abc')).toBe('abc')
    expect(parseUrlVideoId('bilibili', 'https://www.bilibili.com/video/BV1xx411c7abc')).toBe('BV1xx411c7abc')
    expect(parseUrlVideoId('vimeo', 'https://vimeo.com/12345')).toBe('12345')
  })
})

describe('per-source id parsers', () => {
  it('parseVimeoId handles video/, event/, and player URLs', () => {
    expect(parseVimeoId('https://vimeo.com/12345')).toBe('12345')
    expect(parseVimeoId('https://vimeo.com/event/12345')).toBe('12345')
    expect(parseVimeoId('https://player.vimeo.com/video/12345')).toBe('12345')
  })

  it('parseTedSlug extracts the talk slug', () => {
    expect(parseTedSlug('https://www.ted.com/talks/some_talk_name')).toBe('some_talk_name')
  })

  it('parseDailymotionId handles full, short, and embed URLs', () => {
    expect(parseDailymotionId('https://www.dailymotion.com/video/x7abcde')).toBe('x7abcde')
    expect(parseDailymotionId('https://dai.ly/x7abcde')).toBe('x7abcde')
    expect(parseDailymotionId('https://www.dailymotion.com/embed/video/x7abcde')).toBe('x7abcde')
  })

  it('parseFacebookVideoId handles watch, videos/, reel, and fb.watch forms', () => {
    expect(parseFacebookVideoId('https://www.facebook.com/someone/videos/1234567890')).toBe('1234567890')
    expect(parseFacebookVideoId('https://www.facebook.com/watch?v=1234567890')).toBe('1234567890')
    expect(parseFacebookVideoId('https://www.facebook.com/reel/1234567890')).toBe('1234567890')
    expect(parseFacebookVideoId('https://fb.watch/AbC123-_')).toBe('AbC123-_')
  })

  it('parseInstagramCode handles reel/p/tv forms', () => {
    expect(parseInstagramCode('https://www.instagram.com/reel/AbC123_-/')).toBe('AbC123_-')
    expect(parseInstagramCode('https://www.instagram.com/p/AbC123_-/')).toBe('AbC123_-')
  })

  it('parseTweetId handles twitter.com and x.com', () => {
    expect(parseTweetId('https://twitter.com/user/status/1234567890')).toBe('1234567890')
    expect(parseTweetId('https://x.com/user/status/1234567890')).toBe('1234567890')
  })

  it('parseRedditPostId handles full comments URL and redd.it short link', () => {
    expect(parseRedditPostId('https://www.reddit.com/r/sub/comments/abc123/title/')).toBe('abc123')
    expect(parseRedditPostId('https://redd.it/abc123')).toBe('abc123')
  })

  it('parseTikTokId handles the numeric video URL and short links', () => {
    expect(parseTikTokId('https://www.tiktok.com/@user/video/1234567890')).toBe('1234567890')
    expect(parseTikTokId('https://vm.tiktok.com/AbC123/')).toBe('AbC123')
  })

  it('parseLinkedInActivityId handles the activity- form and the urn form', () => {
    expect(parseLinkedInActivityId('https://www.linkedin.com/feed/update/activity-1234567890123')).toBe('1234567890123')
    expect(parseLinkedInActivityId('urn:li:activity:1234567890123')).toBe('1234567890123')
  })

  it('returns null when a URL matches no known pattern for that source', () => {
    expect(parseVimeoId('https://example.com')).toBeNull()
    expect(parseTweetId('https://example.com')).toBeNull()
  })
})

describe('parseExternalVideoId dispatch', () => {
  it('routes to the matching per-source parser for every external source', () => {
    expect(parseExternalVideoId('vimeo', 'https://vimeo.com/1')).toBe('1')
    expect(parseExternalVideoId('ted', 'https://www.ted.com/talks/x')).toBe('x')
    expect(parseExternalVideoId('dailymotion', 'https://dai.ly/x')).toBe('x')
    expect(parseExternalVideoId('facebook', 'https://fb.watch/x')).toBe('x')
    expect(parseExternalVideoId('instagram', 'https://www.instagram.com/p/x/')).toBe('x')
    expect(parseExternalVideoId('twitter', 'https://x.com/u/status/1')).toBe('1')
    expect(parseExternalVideoId('reddit', 'https://redd.it/x')).toBe('x')
    expect(parseExternalVideoId('linkedin', 'urn:li:activity:1234567890123')).toBe('1234567890123')
    expect(parseExternalVideoId('tiktok', 'https://vm.tiktok.com/x/')).toBe('x')
  })
})

describe('embed URL builders', () => {
  it('buildYouTubeEmbedUrl includes start/autoplay only when startSeconds > 0', () => {
    expect(buildYouTubeEmbedUrl('abc')).toBe('https://www.youtube.com/embed/abc')
    expect(buildYouTubeEmbedUrl('abc', 30)).toBe('https://www.youtube.com/embed/abc?start=30&autoplay=1')
  })

  it('buildYouTubeEmbedUrl floors and clamps negative start times to 0', () => {
    expect(buildYouTubeEmbedUrl('abc', -5)).toBe('https://www.youtube.com/embed/abc')
    expect(buildYouTubeEmbedUrl('abc', 30.9)).toBe('https://www.youtube.com/embed/abc?start=30&autoplay=1')
  })

  it('buildBilibiliEmbedUrl includes t/autoplay only when startSeconds > 0', () => {
    expect(buildBilibiliEmbedUrl({ bvid: 'BV1xx', page: 1 })).toBe(
      'https://player.bilibili.com/player.html?bvid=BV1xx&page=1',
    )
    const withStart = buildBilibiliEmbedUrl({ bvid: 'BV1xx', page: 2 }, 10)
    expect(withStart).toContain('t=10')
    expect(withStart).toContain('autoplay=1')
  })

  it('buildExternalEmbedUrl builds vimeo/ted/dailymotion with a #t or ?start fragment', () => {
    expect(buildExternalEmbedUrl('vimeo', '123', 'https://vimeo.com/123')).toBe('https://player.vimeo.com/video/123')
    expect(buildExternalEmbedUrl('vimeo', '123', 'https://vimeo.com/123', 15)).toBe(
      'https://player.vimeo.com/video/123?autoplay=1#t=15s',
    )
  })

  it('buildExternalEmbedUrl wraps the full URL for facebook', () => {
    const url = buildExternalEmbedUrl('facebook', '1', 'https://www.facebook.com/x/videos/1')
    expect(url).toContain(encodeURIComponent('https://www.facebook.com/x/videos/1'))
  })

  it('buildExternalEmbedUrl uses a reddit.com embed path when originalUrl is a reddit URL', () => {
    const url = buildExternalEmbedUrl('reddit', 'abc123', 'https://www.reddit.com/r/sub/comments/abc123/title/')
    expect(url).toBe('https://embed.reddit.com/r/sub/comments/abc123/title/?embed=true')
  })

  it('buildExternalEmbedUrl falls back to an id-only reddit embed for a non-URL originalUrl', () => {
    expect(buildExternalEmbedUrl('reddit', 'abc123', 'not a url')).toBe('https://embed.reddit.com/comments/abc123?embed=true')
  })

  it('buildExternalEmbedUrl builds instagram/twitter/tiktok/linkedin from the id alone', () => {
    expect(buildExternalEmbedUrl('instagram', 'abc', 'https://www.instagram.com/p/abc/')).toBe('https://www.instagram.com/p/abc/embed')
    expect(buildExternalEmbedUrl('twitter', '123', 'https://x.com/u/status/123')).toBe('https://platform.twitter.com/embed/Tweet.html?id=123')
    expect(buildExternalEmbedUrl('tiktok', '123', 'https://www.tiktok.com/@u/video/123')).toBe('https://www.tiktok.com/embed/v2/123')
    expect(buildExternalEmbedUrl('linkedin', '123', 'x')).toBe('https://www.linkedin.com/embed/feed/update/urn:li:activity:123')
  })
})

describe('buildEmbedUrl dispatch', () => {
  it('dispatches youtube/bilibili/external correctly', () => {
    expect(buildEmbedUrl('youtube', 'abc', '')).toBe('https://www.youtube.com/embed/abc')
    expect(buildEmbedUrl('vimeo', '123', 'https://vimeo.com/123')).toBe('https://player.vimeo.com/video/123')
  })

  it('parses the bvid/page from originalUrl for bilibili, falling back to id/page-1', () => {
    const url = buildEmbedUrl('bilibili', 'BV1xx', 'https://www.bilibili.com/video/BV1xx?p=2')
    expect(url).toContain('bvid=BV1xx')
    expect(url).toContain('page=2')

    const fallback = buildEmbedUrl('bilibili', 'BV1xx', 'not a bilibili url')
    expect(fallback).toContain('bvid=BV1xx')
    expect(fallback).toContain('page=1')
  })

  it('returns null for upload and unrecognized source types', () => {
    expect(buildEmbedUrl('upload', 'x', '')).toBeNull()
    expect(buildEmbedUrl('unknown-source', 'x', '')).toBeNull()
    expect(buildEmbedUrl(null, 'x', '')).toBeNull()
    expect(buildEmbedUrl(undefined, 'x', '')).toBeNull()
  })
})
