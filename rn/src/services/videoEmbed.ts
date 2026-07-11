// Trimmed port of web/src/constants/videoSources.ts + pages/videoDetail/helpers.ts —
// only the embed-URL builders, since the WebView just needs a src to load.

export function parseBilibiliVideo(url: string): { bvid: string; page: number } | null {
  const m = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+).*?[?&]p=(\d+)/i) ?? url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i);
  if (!m) return null;
  return { bvid: m[1], page: Math.max(1, Number.parseInt(m[2] ?? '1', 10) || 1) };
}

// A WebView navigated directly to an embed URL sends no Referer/Origin on the
// initial load, which makes YouTube's player reject it with error 153
// ("Video player configuration error"). Wrapping the iframe in an HTML shell
// loaded with a real baseUrl gives it a proper origin, which fixes this.
export function buildEmbedSource(embedUrl: string): { html: string; baseUrl: string } {
  const originMatch = embedUrl.match(/^https?:\/\/[^/]+/);
  const baseUrl = originMatch ? originMatch[0] : embedUrl;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" /></head><body style="margin:0;padding:0;background:#000;overflow:hidden;"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>`;
  return { html, baseUrl };
}

export function buildEmbedUrl(sourceType: string | undefined, videoId: string, originalUrl: string): string | null {
  switch (sourceType) {
    case 'youtube':
      return `https://www.youtube.com/embed/${videoId}`;
    case 'bilibili': {
      const parsed = parseBilibiliVideo(originalUrl) ?? { bvid: videoId, page: 1 };
      return `https://player.bilibili.com/player.html?bvid=${parsed.bvid}&page=${parsed.page}`;
    }
    case 'vimeo':
      return `https://player.vimeo.com/video/${videoId}`;
    case 'ted':
      return `https://embed.ted.com/talks/${videoId}`;
    case 'dailymotion':
      return `https://www.dailymotion.com/embed/video/${videoId}`;
    case 'facebook':
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(originalUrl)}&show_text=false`;
    case 'instagram':
      return `https://www.instagram.com/p/${videoId}/embed`;
    case 'twitter':
      return `https://platform.twitter.com/embed/Tweet.html?id=${videoId}`;
    case 'linkedin':
      return `https://www.linkedin.com/embed/feed/update/urn:li:activity:${videoId}`;
    case 'tiktok':
      return `https://www.tiktok.com/embed/v2/${videoId}`;
    case 'reddit':
      return `https://embed.reddit.com/comments/${videoId}?embed=true`;
    default:
      return null;
  }
}
