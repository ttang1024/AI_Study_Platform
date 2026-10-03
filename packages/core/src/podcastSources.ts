// Shared registry for URL-based podcast episode sources, mirroring videoSources.ts.
// The backend resolves Apple links via the iTunes API and every other episode page
// via generic og:audio / JSON-LD / <audio>-tag extraction, so unknown hosts are still
// attempted — this list only drives UI branding and friendlier validation messages.

export interface PodcastSource {
  id: string;
  label: string;
  domains: string[];
}

export const PODCAST_SOURCES: PodcastSource[] = [
  { id: 'apple', label: 'Apple Podcasts', domains: ['podcasts.apple.com'] },
  { id: 'overcast', label: 'Overcast', domains: ['overcast.fm'] },
  { id: 'castro', label: 'Castro', domains: ['castro.fm'] },
  { id: 'pocketcasts', label: 'Pocket Casts', domains: ['pca.st', 'pocketcasts.com'] },
  { id: 'podbean', label: 'Podbean', domains: ['podbean.com'] },
  { id: 'buzzsprout', label: 'Buzzsprout', domains: ['buzzsprout.com'] },
  { id: 'libsyn', label: 'Libsyn', domains: ['libsyn.com'] },
  { id: 'simplecast', label: 'Simplecast', domains: ['simplecast.com'] },
  { id: 'transistor', label: 'Transistor', domains: ['transistor.fm'] },
  { id: 'playerfm', label: 'Player FM', domains: ['player.fm'] },
  { id: 'castos', label: 'Castos', domains: ['castos.com'] },
  { id: 'podcastaddict', label: 'Podcast Addict', domains: ['podcastaddict.com'] },
];

const AUDIO_FILE_RE = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac)(\?.*)?$/i;

function parseHttpUrl(url: string): URL | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/** Identify a known podcast platform from a pasted URL. Null = unrecognized (still worth trying). */
export function detectPodcastSource(url: string): PodcastSource | null {
  const u = parseHttpUrl(url);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  return PODCAST_SOURCES.find(s =>
    s.domains.some(d => host === d || host.endsWith(`.${d}`))) ?? null;
}

export function isDirectAudioUrl(url: string): boolean {
  const u = parseHttpUrl(url);
  return !!u && AUDIO_FILE_RE.test(u.pathname);
}

// Hosts that only ever serve podcast RSS feeds.
const FEED_HOSTS = [
  'feeds.buzzsprout.com', 'rss.buzzsprout.com', 'feed.podbean.com', 'feeds.simplecast.com',
  'feeds.megaphone.fm', 'feeds.libsyn.com', 'feeds.transistor.fm', 'feeds.acast.com',
  'rss.art19.com', 'feeds.soundcloud.com', 'anchor.fm', 'feeds.captivate.fm',
  'feeds.redcircle.com', 'feeds.fireside.fm', 'rss.com',
];

/**
 * Heuristic: does this URL point at a podcast RSS feed rather than an episode page?
 * Only a fast-path hint — the backend also detects feeds and answers RSS_FEED_URL,
 * so a miss here still ends up in the episode picker.
 */
export function looksLikeRssFeedUrl(url: string): boolean {
  const u = parseHttpUrl(url);
  if (!u) return false;
  const host = u.hostname.toLowerCase();
  if (FEED_HOSTS.some(d => host === d || host.endsWith(`.${d}`))) return true;
  const path = u.pathname.toLowerCase();
  return /\.(rss|xml)$/.test(path) || /(^|\/)(rss|feed|feeds|podcast\.rss)(\/|$)/.test(path);
}

/**
 * Client-side validation before hitting the API.
 * Returns an error message, or null when the URL is worth sending to the backend.
 */
export function validatePodcastUrl(url: string): string | null {
  const u = parseHttpUrl(url);
  if (!u) return 'Please enter a valid episode link (https://…).';
  // Apple show links without ?i= point at a show, not an episode — catch early with a clear hint.
  const host = u.hostname.toLowerCase();
  if ((host === 'podcasts.apple.com' || host.endsWith('.podcasts.apple.com')) && !u.searchParams.has('i')) {
    return 'That Apple Podcasts link is for a show. Open a specific episode and copy its link (it ends with ?i=…).';
  }
  return null;
}
