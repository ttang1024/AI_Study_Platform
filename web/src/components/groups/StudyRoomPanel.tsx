import React, { useEffect, useState } from 'react';
import { Timer, Users, LogIn, LogOut, Coffee, BookOpen } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface StudyRoomState {
  members: { userId: string; name: string; status: 'studying' | 'break' }[];
  timerEndsAt: string | null;
  timerMinutes: number;
  timerStartedBy: string | null;
}

interface StudyRoomPanelProps {
  state: StudyRoomState | null;
  currentUserId: string;
  onJoin: () => void;
  onLeave: () => void;
  onSetStatus: (status: 'studying' | 'break') => void;
  onStartTimer: (minutes: number) => void;
}

const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Live co-study room: who from the group is studying right now, their
 * studying/break status, and a shared focus timer anyone can start.
 */
export const StudyRoomPanel: React.FC<StudyRoomPanelProps> = ({
  state, currentUserId, onJoin, onLeave, onSetStatus, onStartTimer,
}) => {
  const members = state?.members ?? [];
  const me = members.find(m => m.userId === currentUserId);
  const joined = !!me;

  // Tick every second while a shared timer runs.
  const [now, setNow] = useState(Date.now());
  const timerEnds = state?.timerEndsAt ? new Date(state.timerEndsAt).getTime() : null;
  const timerRunning = timerEnds !== null && timerEnds > now;
  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timerRunning]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-teal-600" />
        <h2 className="text-sm font-semibold text-gray-700 flex-1">Live study room</h2>
        {joined ? (
          <button
            onClick={onLeave}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:border-red-200 hover:text-red-500 transition-colors"
          >
            <LogOut size={11} /> Leave
          </button>
        ) : (
          <button
            onClick={onJoin}
            className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <LogIn size={11} /> Join
          </button>
        )}
      </div>

      {/* Shared timer */}
      {timerRunning ? (
        <div className="flex items-center gap-3 rounded-lg bg-teal-50 px-3 py-2.5">
          <Timer size={16} className="text-teal-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black tabular-nums text-teal-700 leading-none">
              {formatRemaining(timerEnds! - now)}
            </p>
            <p className="text-[10px] text-teal-600/80 mt-0.5 truncate">
              {state?.timerMinutes}-min focus · started by {state?.timerStartedBy}
            </p>
          </div>
        </div>
      ) : joined ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">Focus together:</span>
          {[25, 50].map(m => (
            <button
              key={m}
              onClick={() => onStartTimer(m)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-bold text-gray-600 hover:border-teal-400 hover:text-teal-600 transition-colors"
            >
              {m} min
            </button>
          ))}
        </div>
      ) : null}

      {/* Presence */}
      {members.length === 0 ? (
        <p className="text-[11px] text-gray-400">
          Nobody's in the room right now — join and your groupmates will see you studying.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {members.map(m => (
            <li key={m.userId} className="flex items-center gap-2 text-xs text-gray-600">
              <span className={cn(
                'h-2 w-2 rounded-full shrink-0',
                m.status === 'studying' ? 'bg-emerald-500' : 'bg-amber-400',
              )} />
              <span className="flex-1 truncate">{m.name}{m.userId === currentUserId ? ' (you)' : ''}</span>
              <span className="text-[10px] text-gray-400">{m.status === 'studying' ? 'studying' : 'on a break'}</span>
            </li>
          ))}
        </ul>
      )}

      {/* My status toggle */}
      {joined && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-50">
          <button
            onClick={() => onSetStatus('studying')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
              me?.status === 'studying' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <BookOpen size={11} /> Studying
          </button>
          <button
            onClick={() => onSetStatus('break')}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
              me?.status === 'break' ? 'bg-amber-50 text-amber-600' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <Coffee size={11} /> Break
          </button>
        </div>
      )}
    </div>
  );
};
