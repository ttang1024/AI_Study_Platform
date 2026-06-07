export function parseVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/shorts\/([^?&/]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function parseBilibiliVideo(url: string): { bvid: string; page: number; key: string } | null {
  try {
    const u = new URL(url.trim());
    const m = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/i);
    if (!m) return null;
    const page = Math.max(1, Number.parseInt(u.searchParams.get('p') ?? '1', 10) || 1);
    return { bvid: m[1], page, key: page > 1 ? `${m[1]}:p${page}` : m[1] };
  } catch {
    const m = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+).*?[?&]p=(\d+)/i)
      ?? url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i);
    if (!m) return null;
    const page = Math.max(1, Number.parseInt(m[2] ?? '1', 10) || 1);
    return { bvid: m[1], page, key: page > 1 ? `${m[1]}:p${page}` : m[1] };
  }
}

export function buildBilibiliPlayerUrl(video: { bvid: string; page: number }, startSeconds = 0): string {
  const params = new URLSearchParams({
    bvid: video.bvid,
    page: String(video.page),
  });
  const safeSeconds = Math.max(0, Math.floor(startSeconds));
  if (safeSeconds > 0) {
    params.set('t', String(safeSeconds));
    params.set('autoplay', '1');
  }
  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

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
