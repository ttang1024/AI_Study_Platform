/**
 * Small display formatters that both apps had their own copy of. Nothing here touches the DOM or
 * any RN API, so there is no reason for two of each.
 */

export interface TimecodeOptions {
  /** Pad the minutes field below an hour: `05:03` rather than `5:03`. */
  padMinutes?: boolean;
}

/**
 * Seconds as `h:mm:ss`, dropping the hours field when there isn't one.
 *
 * Two call sites want slightly different minute padding — media timelines line up better padded,
 * inline citations read better without — so that stays an option rather than becoming a third copy.
 * Negative input is clamped: it can only come from bad data, and `-1:-3` helps nobody.
 */
export const formatTimecode = (seconds: number, { padMinutes = false }: TimecodeOptions = {}): string => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${padMinutes ? pad(m) : m}:${pad(s)}`;
};

/** Milliseconds as `m:ss` — countdown timers. */
export const formatCountdown = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** File size in MB above 1MB, KB below. Empty string for absent/zero, which reads as "unknown". */
export const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/**
 * `YYYY-MM-DD` in the viewer's own timezone — the key calendars group by.
 *
 * Deliberately not `toISOString().slice(0, 10)`, which would be the *UTC* day and files anything
 * near midnight under the wrong date.
 */
export const toLocalDateKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
