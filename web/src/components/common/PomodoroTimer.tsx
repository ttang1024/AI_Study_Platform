import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Play, Pause, RotateCcw, X, Minus, Plus, Coffee, Brain, ChevronDown, GripVertical } from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';
import { pomodoroSettings } from '../../services/pomodoroSettings';
import { cn } from '../../utils/cn';

type Mode = 'focus' | 'break';

// Public / auth pages where the floating timer should not appear.
const HIDDEN_PATHS = ['/', '/login', '/register', '/verify-email', '/auth/callback'];
const isHiddenPath = (path: string) =>
  HIDDEN_PATHS.includes(path) || path.startsWith('/share/');

const STORAGE_KEY = 'pomodoro-v1';
const POS_KEY = 'pomodoro-pos';
const EDGE = 8; // viewport gap when clamping the dragged window
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

interface Pos { x: number; y: number }

const loadPos = (): Pos | null => {
  try {
    const raw = localStorage.getItem(POS_KEY);
    return raw ? (JSON.parse(raw) as Pos) : null;
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
  const [enabled, setEnabled] = useState(() => pomodoroSettings.isEnabled());
  const [pos, setPos] = useState<Pos | null>(() => loadPos());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const movedRef = useRef(false);
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

  // Re-show when the user toggles the timer back on from Settings.
  useEffect(() => pomodoroSettings.subscribe(setEnabled), []);

  // Persist the dragged position.
  useEffect(() => {
    try {
      if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos));
      else localStorage.removeItem(POS_KEY);
    } catch { /* ignore */ }
  }, [pos]);

  // Keep the window inside the viewport when it resizes or changes size
  // (collapsed bubble ↔ expanded panel).
  const clampIntoView = useCallback(() => {
    setPos((p) => {
      const el = containerRef.current;
      if (!p || !el) return p;
      const x = Math.min(Math.max(EDGE, p.x), window.innerWidth - el.offsetWidth - EDGE);
      const y = Math.min(Math.max(EDGE, p.y), window.innerHeight - el.offsetHeight - EDGE);
      return x === p.x && y === p.y ? p : { x, y };
    });
  }, []);

  useEffect(() => { clampIntoView(); }, [open, enabled, clampIntoView]);
  useEffect(() => {
    window.addEventListener('resize', clampIntoView);
    return () => window.removeEventListener('resize', clampIntoView);
  }, [clampIntoView]);

  // Pointer-based dragging from a handle. Buttons opt out via [data-no-drag].
  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    movedRef.current = false;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!movedRef.current && Math.hypot(dx, dy) < 4) return;
      movedRef.current = true;
      setPos({
        x: Math.min(Math.max(EDGE, rect.left + dx), window.innerWidth - el.offsetWidth - EDGE),
        y: Math.min(Math.max(EDGE, rect.top + dy), window.innerHeight - el.offsetHeight - EDGE),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const close = () => {
    setOpen(false);
    pomodoroSettings.setEnabled(false);
  };

  // When anchored by a drag, inline coordinates override the default corner.
  const posStyle: React.CSSProperties | undefined = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : undefined;

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

  // Hidden on public/auth pages, or closed by the user (re-enable in Settings).
  // The timer keeps ticking in the background either way.
  if (hidden || !enabled) return null;

  // ── Collapsed floating button ──
  if (!open) {
    return (
      <div ref={containerRef} className="group fixed bottom-6 right-6 z-40" style={posStyle}>
        <button
          onClick={() => {
            if (movedRef.current) { movedRef.current = false; return; }
            setOpen(true);
          }}
          onPointerDown={startDrag}
          title="Pomodoro timer (drag to move)"
          className="flex h-14 w-14 touch-none items-center justify-center rounded-full bg-white shadow-lg border border-[var(--border-color)] transition-transform hover:scale-105 active:cursor-grabbing"
          style={isActive ? { boxShadow: `0 0 0 2px ${accent}33, 0 8px 24px rgba(0,0,0,0.12)` } : undefined}
        >
          {running ? (
            <span className="text-[12px] font-bold tabular-nums" style={{ color: accent }}>{fmt(remaining)}</span>
          ) : (
            <Timer size={22} style={{ color: isActive ? accent : 'var(--text-muted)' }} />
          )}
        </button>
        <button
          data-no-drag
          onClick={close}
          title="Close timer"
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-color)] bg-white text-text-muted opacity-0 shadow transition-opacity hover:text-red-500 group-hover:opacity-100"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  // ── Expanded panel ──
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ duration: 0.16 }}
        style={posStyle}
        className="fixed bottom-6 right-6 z-40 w-64 rounded-2xl bg-white p-4 shadow-2xl border border-[var(--border-color)]"
      >
        {/* Header (drag handle) */}
        <div onPointerDown={startDrag} className="mb-3 flex touch-none cursor-grab items-center justify-between active:cursor-grabbing">
          <div data-no-drag className="flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5">
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
          <div className="flex items-center gap-0.5">
            <GripVertical size={14} className="text-zinc-300" />
            <button data-no-drag onClick={() => setOpen(false)} className="text-text-muted hover:text-text-main transition-colors" title="Minimize">
              <ChevronDown size={16} />
            </button>
            <button data-no-drag onClick={close} className="text-text-muted hover:text-red-500 transition-colors" title="Close timer">
              <X size={16} />
            </button>
          </div>
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
