// URL parsing and the player-embed builders live in the shared package
// (@core/videoSources) — rn's WebView player and the share page build the same
// URLs. Re-exported under this page's historical names.
export {
  parseYouTubeId as parseVideoId,
  parseBilibiliVideo,
  buildBilibiliEmbedUrl as buildBilibiliPlayerUrl,
} from '@core/videoSources';

export function isOptionCorrect(option: string, answer: string): boolean {
  if (option === answer) return true;
  const letter = option.match(/^([A-D])[).:\s]/i)?.[1]?.toUpperCase();
  return letter !== undefined && letter === answer.trim().toUpperCase();
}

export const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const fmtSrtTime = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};
