export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/** Compact minutes → "3h 12m" / "45m" / "0m". */
export function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m}m`;
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

/** Short day label like "Jun 25" for chart axes / tooltips. */
export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
