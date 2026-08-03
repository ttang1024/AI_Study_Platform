/**
 * Client-side cue parsing for the caption formats the platform accepts.
 *
 * The server-side extractor strips timings entirely (the AI only wants prose);
 * the viewer wants the opposite — the timestamp is how a learner navigates a
 * transcript — so captions are fetched raw and parsed here.
 */

export interface Cue {
  start?: string;
  end?: string;
  text: string;
}

const SUBTITLE_EXTENSIONS = ['srt', 'vtt', 'sbv', 'ass', 'ssa', 'sub', 'lrc', 'ttml', 'dfxp'];

export const isSubtitleFile = (fileName: string): boolean =>
  SUBTITLE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(`.${ext}`));

const stripTags = (text: string) => text.replace(/<[^>]*>/g, '').trim();

// "00:00:01,000" / "0:00:01.000" → "0:01" (or "1:00:01" past the hour).
const shortTime = (raw: string): string => {
  const match = raw.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d+))?$/);
  if (!match) return raw.trim();

  const [, h, m, s] = match;
  const hours = Number(h ?? 0);
  const minutes = Number(m);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${s}`
    : `${minutes}:${s}`;
};

const parseTimedBlocks = (raw: string, timingLine: RegExp): Cue[] => {
  const cues: Cue[] = [];
  let current: Cue | null = null;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();

    const timing = line.match(timingLine);
    if (timing) {
      current = { start: shortTime(timing[1]), end: shortTime(timing[2]), text: '' };
      cues.push(current);
      continue;
    }

    if (line === '') {
      current = null;
      continue;
    }
    // Cue numbers and the WEBVTT header are not content.
    if (!current && (/^\d+$/.test(line) || /^WEBVTT/i.test(line))) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(line)) continue;

    const text = stripTags(line);
    if (!text) continue;

    if (current) current.text = current.text ? `${current.text}\n${text}` : text;
    else cues.push({ text });
  }

  return cues.filter(cue => cue.text.length > 0);
};

const parseAss = (raw: string): Cue[] => {
  const cues: Cue[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    if (!/^Dialogue:/i.test(rawLine.trim())) continue;

    const fields = rawLine.trim().split(',');
    if (fields.length < 10) continue;

    const text = fields
      .slice(9)
      .join(',')
      .replace(/\{[^}]*\}/g, '')
      .replace(/\\N|\\n/g, '\n')
      .replace(/\\h/g, ' ')
      .trim();
    if (!text) continue;

    cues.push({ start: shortTime(fields[1]), end: shortTime(fields[2]), text });
  }
  return cues;
};

const parseLrc = (raw: string): Cue[] => {
  const cues: Cue[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const stamps = [...rawLine.matchAll(/\[(\d{1,2}:\d{2}(?:[.:]\d+)?)\]/g)].map(m => m[1]);
    const text = rawLine.replace(/^(\[[^\]]*\])+/, '').trim();
    if (!text) continue;

    cues.push({ start: stamps.length > 0 ? shortTime(`0:${stamps[0]}`) : undefined, text });
  }
  return cues;
};

// MicroDVD ({start}{end}text) and SubViewer ([hh:mm:ss] blocks).
const parseSub = (raw: string): Cue[] => {
  const cues: Cue[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || (line.startsWith('[') && line.endsWith(']'))) continue;

    const frames = line.match(/^\{(\d+)\}\{(\d+)\}(.*)$/);
    const text = (frames ? frames[3] : line).replace(/\|/g, '\n').trim();
    if (!text || /^[\d:.,\s>-]+$/.test(text)) continue;

    cues.push({ text });
  }
  return cues;
};

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ',
};

const decodeEntities = (text: string) =>
  text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, entity => XML_ENTITIES[entity.toLowerCase()] ?? entity);

// TTML/DFXP is XML, but this runs on React Native too, where there is no
// DOMParser — and a cue list only needs <p> elements, their begin/end
// attributes, and <br/> as the in-cue line break.
const parseTtml = (raw: string): Cue[] => {
  const cues: Cue[] = [];

  for (const match of raw.matchAll(/<(?:\w+:)?p\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?p>/gi)) {
    const [, attributes, body] = match;
    const begin = attributes.match(/\bbegin\s*=\s*"([^"]*)"/i)?.[1];
    const end = attributes.match(/\bend\s*=\s*"([^"]*)"/i)?.[1];

    const text = decodeEntities(
      body
        .replace(/<(?:\w+:)?br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ''),
    )
      .replace(/[ \t]+/g, ' ')
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
    if (!text) continue;

    cues.push({
      start: begin ? shortTime(begin) : undefined,
      end: end ? shortTime(end) : undefined,
      text,
    });
  }

  return cues;
};

export function parseCues(raw: string, fileName: string): Cue[] {
  const name = fileName.toLowerCase();

  if (name.endsWith('.ass') || name.endsWith('.ssa')) return parseAss(raw);
  if (name.endsWith('.lrc')) return parseLrc(raw);
  if (name.endsWith('.sub')) return parseSub(raw);
  if (name.endsWith('.ttml') || name.endsWith('.dfxp')) return parseTtml(raw);
  if (name.endsWith('.sbv'))
    return parseTimedBlocks(raw, /^(\d+:\d{2}:\d{2}[.,]\d+)\s*,\s*(\d+:\d{2}:\d{2}[.,]\d+)$/);

  // .srt and .vtt share the "start --> end" cue header.
  return parseTimedBlocks(raw, /^([\d:.,]+)\s*-->\s*([\d:.,]+)/);
}
