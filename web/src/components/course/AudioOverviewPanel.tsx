import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Loader2, Play, RefreshCw, AlertTriangle, MessageSquareText } from 'lucide-react';
import { audioOverviewService, type AudioOverview } from '../../services/audioOverviewService';

const POLL_MS = 5_000;

/**
 * NotebookLM-style "audio overview" of a course: two AI hosts discuss the
 * course's summarized materials. Generation runs server-side; this panel
 * requests it, polls while it's in flight, and plays the stitched MP3.
 */
export const AudioOverviewPanel: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [overview, setOverview] = useState<AudioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inFlight = overview?.status === 'pending' || overview?.status === 'processing';

  useEffect(() => {
    let cancelled = false;
    audioOverviewService.get(courseId)
      .then(o => { if (!cancelled) setOverview(o); })
      .catch(() => { /* panel stays in its empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  // Poll while generation is running.
  useEffect(() => {
    if (!inFlight) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(() => {
      audioOverviewService.get(courseId).then(o => o && setOverview(o)).catch(() => { });
    }, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [inFlight, courseId]);

  const generate = async () => {
    setRequesting(true);
    setError(null);
    try {
      setOverview(await audioOverviewService.generate(courseId));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not start generation.');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return null;

  const minutes = overview?.durationSeconds ? Math.max(1, Math.round(overview.durationSeconds / 60)) : null;

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
          <AudioLines size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text-main">Audio overview</p>
          <p className="text-xs text-text-muted">
            {overview?.status === 'ready'
              ? `Two AI hosts walk through this course${minutes ? ` · ~${minutes} min` : ''}`
              : inFlight
                ? 'Writing the script and recording both hosts — this takes a few minutes.'
                : overview?.status === 'failed'
                  ? 'Last attempt failed — you can retry.'
                  : 'Generate a podcast-style discussion of this course’s materials.'}
          </p>
        </div>

        {inFlight ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-600">
            <Loader2 size={13} className="animate-spin" /> Generating…
          </span>
        ) : (
          <button
            onClick={generate}
            disabled={requesting}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-600 transition-colors disabled:opacity-50"
          >
            {requesting
              ? <Loader2 size={13} className="animate-spin" />
              : overview?.status === 'ready' ? <RefreshCw size={13} /> : <Play size={13} />}
            {overview?.status === 'ready' ? 'Regenerate' : 'Generate'}
          </button>
        )}
      </div>

      {overview?.status === 'failed' && overview.error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle size={12} /> {overview.error}
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {overview?.status === 'ready' && overview.audioUrl && (
        <div className="mt-3 space-y-2">
          <audio controls preload="none" src={overview.audioUrl} className="w-full" />
          {overview.script && overview.script.length > 0 && (
            <>
              <button
                onClick={() => setShowTranscript(v => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:underline"
              >
                <MessageSquareText size={12} />
                {showTranscript ? 'Hide transcript' : 'Show transcript'}
              </button>
              {showTranscript && (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-[var(--bg-app)] p-3">
                  {overview.script.map((turn, i) => (
                    <p key={i} className="text-xs leading-relaxed text-text-main">
                      <span className={turn.speaker === 'A' ? 'font-bold text-violet-600' : 'font-bold text-teal-600'}>
                        {turn.speaker === 'A' ? 'Host A' : 'Host B'}:
                      </span>{' '}
                      {turn.text}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
