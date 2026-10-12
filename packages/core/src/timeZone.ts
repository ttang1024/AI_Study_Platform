/**
 * The device's IANA time zone (e.g. "Pacific/Auckland"), sent as X-Time-Zone so the server counts the
 * user's days — streaks, today's minutes, reminders — from their own midnight rather than UTC's.
 * Undefined where the runtime has no Intl time-zone support; the server then falls back to the zone
 * saved on the account, or UTC.
 */
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** `{ 'X-Time-Zone': zone }`, or nothing when the zone is unknown. */
export function timeZoneHeaders(): Record<string, string> {
  const zone = deviceTimeZone();
  return zone ? { 'X-Time-Zone': zone } : {};
}
