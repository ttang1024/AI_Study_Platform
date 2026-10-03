export interface TranscriptSegment { start: number; end: number; text: string; }

/** Parses a stored transcript into timed segments, or null for plain-text transcripts. */
export function parseTranscript(raw: string | null): TranscriptSegment[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && 'start' in parsed[0]) return parsed;
  } catch { }
  return null; // plain text — caller handles it
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
