import React, { useEffect, useState } from 'react';
import { CalendarPlus, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { calendarService, type CalendarFeed } from '../../services/calendarService';

/**
 * Two-way calendar sync (import side): subscribe to Google/Apple/Outlook ICS
 * "secret address" feeds so the planner can schedule study around commitments.
 */
export const ConnectedCalendarsCard: React.FC = () => {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    calendarService.getFeeds()
      .then(setFeeds)
      .catch(() => { /* card stays empty */ })
      .finally(() => setLoading(false));
  }, []);

  const addFeed = async () => {
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const feed = await calendarService.addFeed(name.trim() || 'Calendar', url.trim());
      setFeeds(prev => [...prev, feed]);
      setName('');
      setUrl('');
      setShowForm(false);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not connect that calendar.');
    } finally {
      setAdding(false);
    }
  };

  const removeFeed = async (feedId: string) => {
    setFeeds(prev => prev.filter(f => f.id !== feedId)); // optimistic
    calendarService.removeFeed(feedId).catch(() => calendarService.getFeeds().then(setFeeds));
  };

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
      <h4 className="font-semibold text-text-main">Connected calendars</h4>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">
        Paste a calendar's secret ICS address (Google: Settings → "Secret address in iCal format")
        and the planner will schedule study around your real commitments.
      </p>

      {loading ? (
        <Loader2 size={16} className="animate-spin text-zinc-300 mt-4" />
      ) : (
        <div className="mt-3 space-y-2">
          {feeds.map(feed => (
            <div key={feed.id} className="flex items-center gap-2 rounded-xl bg-white border border-[var(--border-color)] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text-main truncate">{feed.name}</p>
                <p className="text-[10px] text-text-muted truncate">
                  {feed.lastError
                    ? <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle size={10} /> sync failed</span>
                    : feed.lastSyncedAt
                      ? `synced ${new Date(feed.lastSyncedAt).toLocaleString()}`
                      : 'not synced yet'}
                </p>
              </div>
              <button
                onClick={() => removeFeed(feed.id)}
                className="shrink-0 text-zinc-400 hover:text-red-500 transition-colors"
                title="Disconnect calendar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            placeholder="Name (e.g. Uni timetable)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-color)] bg-white px-3 py-2 text-xs outline-none focus:border-[var(--primary)]"
          />
          <input
            type="url"
            placeholder="https://calendar.google.com/…/basic.ics"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-color)] bg-white px-3 py-2 text-xs outline-none focus:border-[var(--primary)]"
          />
          {error && <p className="text-[10px] text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={addFeed}
              disabled={adding || !url.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {adding ? <Loader2 size={13} className="animate-spin" /> : <CalendarPlus size={13} />}
              Connect
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-main hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <CalendarPlus size={13} /> Connect a calendar
        </button>
      )}
    </div>
  );
};
