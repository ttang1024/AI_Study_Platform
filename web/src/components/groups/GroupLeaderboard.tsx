import React, { useState, useEffect } from 'react';
import { Trophy, Medal } from 'lucide-react';
import studyGroupService, { type GroupLeaderboard as Leaderboard } from '../../services/studyGroupService';
import { cn } from '../../utils/cn';

export const GroupLeaderboard: React.FC<{ groupId: string }> = ({ groupId }) => {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    studyGroupService.getLeaderboard(groupId, days)
      .then((res) => setBoard(res.data?.data ?? null))
      .catch(() => setBoard(null))
      .finally(() => setLoading(false));
  }, [groupId, days]);

  const rankBadge = (rank: number) => {
    if (rank === 1) return <Medal size={16} className="text-amber-400" />;
    if (rank === 2) return <Medal size={16} className="text-gray-400" />;
    if (rank === 3) return <Medal size={16} className="text-amber-700" />;
    return <span className="text-xs text-gray-400 w-4 text-center">{rank}</span>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <Trophy size={15} className="text-amber-400" />
        <h2 className="text-sm font-semibold text-gray-700">Leaderboard</h2>
        <div className="ml-auto flex gap-1">
          {[7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'text-[11px] font-medium px-2 py-1 rounded-lg border transition-colors',
                days === d ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50',
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
          </div>
        ) : !board || board.entries.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">No activity yet this period.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {board.entries.map((e) => (
              <li
                key={e.userId}
                className={cn('flex items-center gap-3 px-4 py-3', e.isMe && 'bg-teal-50/60')}
              >
                <span className="shrink-0 w-5 flex justify-center">{rankBadge(e.rank)}</span>
                <span className="flex-1 text-sm text-gray-700 truncate font-medium">
                  {e.name}{e.isMe && <span className="text-teal-600 text-xs ml-1">(you)</span>}
                </span>
                <span className="text-[11px] text-gray-400">{e.studyMinutes}m · {e.quizCorrect}✓</span>
                <span className="text-sm font-bold text-teal-700">{e.xp} XP</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-50 shrink-0">
        XP = study minutes + 2 × correct quiz answers in the period.
      </p>
    </div>
  );
};
