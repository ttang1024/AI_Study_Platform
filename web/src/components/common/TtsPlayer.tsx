import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Volume2, Play, Pause, SkipBack, SkipForward, X, Timer, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { TtsState, SLEEP_OPTIONS } from '../../hooks/useTts';

interface TtsPlayerProps {
  state: TtsState;
  title: string;
  subtitle?: string;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
  disableSkipBack?: boolean;
  disableSkipForward?: boolean;
  sleepTimeLeft?: string | null;
  hasSleepTimer?: boolean;
  onSetSleepTimer?: (minutes: number) => void;
  onCancelSleepTimer?: () => void;
  error?: string | null;
  onDismissError?: () => void;
}

export const TtsPlayer: React.FC<TtsPlayerProps> = ({
  state,
  title,
  subtitle,
  onPlay,
  onPause,
  onStop,
  onSkipBack,
  onSkipForward,
  disableSkipBack,
  disableSkipForward,
  sleepTimeLeft,
  hasSleepTimer,
  onSetSleepTimer,
  onCancelSleepTimer,
  error,
  onDismissError,
}) => {
  const [showSleepMenu, setShowSleepMenu] = useState(false);

  return ReactDOM.createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(600px,calc(100vw-2rem))] space-y-2">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl shadow-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
          {onDismissError && (
            <button onClick={onDismissError} className="p-0.5 rounded text-red-400 hover:text-red-600 transition-colors shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {state !== 'idle' && (
        <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4">
          {/* Icon */}
          <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0 relative">
            <Volume2 size={18} className={state === 'loading' ? 'text-[var(--primary)]/40' : 'text-[var(--primary)]'} />
            {state === 'loading' && (
              <span className="absolute inset-0 rounded-xl border-2 border-[var(--primary)]/30 border-t-[var(--primary)] animate-spin" />
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            {subtitle && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{subtitle}</p>
            )}
            <p className="text-sm font-semibold text-text-main truncate">{title}</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {onSkipBack && (
              <button
                onClick={onSkipBack}
                disabled={disableSkipBack}
                className="p-2 rounded-lg hover:bg-zinc-100 text-text-muted hover:text-text-main disabled:opacity-30 transition-all"
              >
                <SkipBack size={16} />
              </button>
            )}
            {state === 'loading' ? (
              <div className="p-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)]">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : state === 'playing' ? (
              <button onClick={onPause} className="p-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-all">
                <Pause size={16} />
              </button>
            ) : (
              <button onClick={onPlay} className="p-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-all">
                <Play size={16} className="fill-current" />
              </button>
            )}
            {onSkipForward && (
              <button
                onClick={onSkipForward}
                disabled={disableSkipForward}
                className="p-2 rounded-lg hover:bg-zinc-100 text-text-muted hover:text-text-main disabled:opacity-30 transition-all"
              >
                <SkipForward size={16} />
              </button>
            )}
          </div>

          {/* Sleep timer (optional) */}
          {onSetSleepTimer && (
            <div className="relative shrink-0">
              {hasSleepTimer ? (
                <button
                  onClick={onCancelSleepTimer}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-all"
                >
                  <Timer size={13} />
                  {sleepTimeLeft}
                  <X size={12} />
                </button>
              ) : (
                <button
                  onClick={() => setShowSleepMenu(v => !v)}
                  className="flex items-center gap-1 p-2 rounded-lg hover:bg-zinc-100 text-text-muted hover:text-text-main transition-all"
                  title="Set sleep timer"
                >
                  <Timer size={16} />
                  <ChevronDown size={12} />
                </button>
              )}
              {showSleepMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-lg overflow-hidden min-w-[120px]">
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Stop after</p>
                  {SLEEP_OPTIONS.map(o => (
                    <button
                      key={o.minutes}
                      onClick={() => { onSetSleepTimer(o.minutes); setShowSleepMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-all"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Close */}
          <button onClick={onStop} className="p-1.5 rounded-lg hover:bg-zinc-100 text-text-muted hover:text-text-main transition-all shrink-0">
            <X size={15} />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
};
