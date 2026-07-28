// URL parsing and the embed-URL builders live in the shared package
// (@core/videoSources) — web builds the same URLs. Only the WebView shell below
// is mobile-specific.
export { buildEmbedUrl, parseBilibiliVideo } from '@core/videoSources';

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
