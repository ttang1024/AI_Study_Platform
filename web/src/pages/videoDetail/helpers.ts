// URL parsing and the player-embed builders live in the shared package
// (@core/videoSources) — rn's WebView player and the share page build the same
// URLs. Re-exported under this page's historical names.
export {
  parseYouTubeId as parseVideoId,
  parseBilibiliVideo,
  buildBilibiliEmbedUrl as buildBilibiliPlayerUrl,
} from '@core/videoSources';

export const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

