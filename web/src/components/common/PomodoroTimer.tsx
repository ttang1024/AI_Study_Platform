import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Play, Pause, RotateCcw, X, Minus, Plus, Coffee, Brain } from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';
import { cn } from '../../utils/cn';

type Mode = 'focus' | 'break';

// Public / auth pages where the floating timer should not appear.
const HIDDEN_PATHS = ['/', '/login', '/register', '/verify-email', '/auth/callback'];
const isHiddenPath = (path: string) =>
  HIDDEN_PATHS.includes(path) || path.startsWith('/share/');

const STORAGE_KEY = 'pomodoro-v1';
const DEFAULT_FOCUS_MIN = 25;
const BREAK_MIN = 5;
const MIN_FOCUS = 5;
const MAX_FOCUS = 120;

interface Persisted {
  mode: Mode;
  focusMinutes: number;
  customized: boolean;
  running: boolean;
  endsAt: number | null;
  remaining: number; // seconds
}

const loadPersisted = (): Persisted | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

// Short two-tone chime when a session ends.
const beep = () => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    g.gain.value = 0.08;
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(660, ctx.currentTime + 0.16);
    o.start();
    o.stop(ctx.currentTime + 0.32);
    o.onended = () => ctx.close();
  } catch { /* audio may be blocked */ }
};

const notify = (finishedMode: Mode) => {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pomodoro', {
        body: finishedMode === 'focus' ? 'Focus session complete — time for a break!' : 'Break over — back to focus.',
      });
    }
  } catch { /* ignore */ }
};

export const PomodoroTimer: React.FC = () => {
  const hidden = isHiddenPath(useLocation().pathname);
  const persisted = useRef<Persisted | null>(loadPersisted()).current;
  const isFresh = useRef(persisted === null);
  const fetchedRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(persisted?.mode ?? 'focus');
  const [focusMinutes, setFocusMinutes] = useState(persisted?.focusMinutes ?? DEFAULT_FOCUS_MIN);
  const [customized, setCustomized] = useState(persisted?.customized ?? false);
  const [running, setRunning] = useState(persisted?.running ?? false);
  const [endsAt, setEndsAt] = useState<number | null>(persisted?.endsAt ?? null);
  const [remaining, setRemaining] = useState<number>(() => {
    if (persisted) {
      return persisted.running && persisted.endsAt
        ? Math.max(0, Math.round((persisted.endsAt - Date.now()) / 1000))
        : persisted.remaining;
    }
    return DEFAULT_FOCUS_MIN * 60;
  });

  const totalSeconds = (mode === 'focus' ? focusMinutes : BREAK_MIN) * 60;

  // The first time the timer is visible on a fresh load, default the focus
  // length to the user's daily goal. Deferred until visible so it doesn't hit
  // the authed endpoint on public/auth pages.
  useEffect(() => {
    if (hidden || fetchedRef.current || !isFresh.current) return;
    fetchedRef.current = true;
    analyticsService.getDashboardSummary()
      .then((s) => {
        if (s.dailyGoalMinutes >= MIN_FOCUS) {
          const m = Math.min(MAX_FOCUS, s.dailyGoalMinutes);
          setFocusMinutes(m);
          setRemaining(m * 60);
        }
      })
      .catch(() => {});
  }, [hidden]);

  // Tick while running; complete at zero.
  useEffect(() => {
    if (!running || endsAt == null) return;
    const id = setInterval(() => {
      const left = Math.round((endsAt - Date.now()) / 1000);
      if (left <= 0) {
        setRunning(false);
        setEndsAt(null);
        beep();
        notify(mode);
        const nextMode: Mode = mode === 'focus' ? 'break' : 'focus';
        setMode(nextMode);
        setRemaining((nextMode === 'focus' ? focusMinutes : BREAK_MIN) * 60);
        setOpen(true);
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, endsAt, mode, focusMinutes]);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, focusMinutes, customized, running, endsAt, remaining }));
    } catch { /* ignore */ }
  }, [mode, focusMinutes, customized, running, endsAt, remaining]);

  const toggle = () => {
    if (running) {
      setRunning(false);
      setEndsAt(null);
      return;
    }
    if (remaining <= 0) return;
    setEndsAt(Date.now() + remaining * 1000);
    setRunning(true);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const reset = () => {
    setRunning(false);
    setEndsAt(null);
    setRemaining(totalSeconds);
  };

  const switchMode = (m: Mode) => {
    setRunning(false);
    setEndsAt(null);
    setMode(m);
    setRemaining((m === 'focus' ? focusMinutes : BREAK_MIN) * 60);
  };

  const adjustFocus = (delta: number) => {
    if (running || mode !== 'focus') return;
    setCustomized(true);
    setFocusMinutes((m) => {
      const next = Math.min(MAX_FOCUS, Math.max(MIN_FOCUS, m + delta));
      setRemaining(next * 60);
      return next;
    });
  };

  const accent = mode === 'focus' ? 'var(--primary)' : '#f59e0b';
  const progress = totalSeconds > 0 ? 1 - Math.min(1, Math.max(0, remaining / totalSeconds)) : 0;
  const isActive = running || remaining !== totalSeconds;

  // Hidden on public/auth pages — the timer keeps ticking in the background.
  if (hidden) return null;

  // ── Collapsed floating button ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Pomodoro timer"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg border border-[var(--border-color)] hover:scale-105 transition-transform"
        style={isActive ? { boxShadow: `0 0 0 2px ${accent}33, 0 8px 24px rgba(0,0,0,0.12)` } : undefined}
      >
        {running ? (
          <span className="text-[12px] font-bold tabular-nums" style={{ color: accent }}>{fmt(remaining)}</span>
        ) : (
          <Timer size={22} style={{ color: isActive ? accent : 'var(--text-muted)' }} />
        )}
      </button>
    );
  }

  // ── Expanded panel ──
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ duration: 0.16 }}
        className="fixed bottom-6 right-6 z-40 w-64 rounded-2xl bg-white p-4 shadow-2xl border border-[var(--border-color)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5">
            {(['focus', 'break'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors',
                  mode === m ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main',
                )}
              >
                {m === 'focus' ? <Brain size={12} /> : <Coffee size={12} />}
                {m}
              </button>
            ))}
          </div>
          <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-main transition-colors" title="Minimize">
            <X size={16} />
          </button>
        </div>

        {/* Ring */}
        <div className="relative mx-auto h-32 w-32">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#f1f1f3" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={R} fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.3s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums text-text-main">{fmt(remaining)}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{mode}</span>
          </div>
        </div>

        {/* Duration stepper (focus, idle only) */}
        {mode === 'focus' && !running && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <button onClick={() => adjustFocus(-5)} disabled={focusMinutes <= MIN_FOCUS} className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-text-muted hover:text-text-main disabled:opacity-40">
              <Minus size={14} />
            </button>
            <span className="text-[12px] font-semibold text-text-muted tabular-nums">{focusMinutes} min</span>
            <button onClick={() => adjustFocus(5)} disabled={focusMinutes >= MAX_FOCUS} className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-text-muted hover:text-text-main disabled:opacity-40">
              <Plus size={14} />
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={toggle}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {running ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Start</>}
          </button>
          <button
            onClick={reset}
            title="Reset"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-text-muted hover:text-text-main transition-colors"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
