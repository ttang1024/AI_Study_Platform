import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, CalendarRange, Flame, BrainCircuit, Award, BookX } from 'lucide-react';
import { gamificationService, type UserXp, type WeeklyDigest } from '../../services/gamificationService';

/** Level + XP progress and the "your week in review" digest, side by side. */
export const XpDigestCards: React.FC = () => {
  const [xp, setXp] = useState<UserXp | null>(null);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);

  useEffect(() => {
    // Validate the shape, not just the rejection. Both values render behind `!xp` /
    // `!digest` skeleton branches that a truthy-but-malformed response (e.g. []) slips
    // past, and their fields are then dereferenced unguarded.
    gamificationService.getXp().then(x => setXp(x?.breakdown ? x : null)).catch(() => {});
    gamificationService.getWeeklyDigest().then(d => setDigest(d?.dailyMinutes ? d : null)).catch(() => {});
  }, []);

  const maxDay = Math.max(1, ...(digest?.dailyMinutes.map((d) => d.minutes) ?? [1]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* XP / level */}
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={15} className="text-amber-500" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Level & XP</p>
        </div>
        {!xp ? (
          <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
        ) : (
          <>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black text-text-main">Lv {xp.level}</span>
              <span className="text-sm text-text-muted mb-1">{xp.totalXp.toLocaleString()} XP total</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                style={{ width: `${Math.round(xp.levelProgress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-text-muted">
              {xp.xpIntoLevel.toLocaleString()} / {xp.xpForNextLevel.toLocaleString()} XP to level {xp.level + 1}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {xp.breakdown.map((b) => (
                <p key={b.source} className="text-[11px] text-text-muted">
                  <span className="font-semibold text-text-main">{b.xp.toLocaleString()}</span> · {b.label}
                </p>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Weekly digest */}
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <CalendarRange size={15} className="text-teal-600" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Your week</p>
        </div>
        {!digest ? (
          <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
        ) : (
          <>
            <p className="text-sm font-semibold text-text-main">{digest.headline}</p>

            {/* Mini bar chart of the last 7 days */}
            <div className="mt-3 flex items-end gap-1 h-12">
              {digest.dailyMinutes.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-teal-500/80 min-h-[2px]"
                    style={{ height: `${Math.max(4, (d.minutes / maxDay) * 100)}%` }}
                    title={`${d.minutes} min`}
                  />
                  <span className="text-[9px] text-text-muted">
                    {new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
              <span className="inline-flex items-center gap-1"><Flame size={11} className="text-orange-400" /> {digest.currentStreak}-day streak</span>
              <span className="inline-flex items-center gap-1"><BrainCircuit size={11} className="text-teal-500" /> {digest.flashcardReviews} reviews</span>
              <span className="inline-flex items-center gap-1"><Award size={11} className="text-amber-500" /> {digest.quizzesTaken} quizzes ({digest.quizAccuracy}%)</span>
              {digest.openMistakes > 0 && (
                <Link to="/quizzes?tab=mistakes" className="inline-flex items-center gap-1 text-red-500 hover:underline">
                  <BookX size={11} /> {digest.openMistakes} open mistakes
                </Link>
              )}
            </div>
            {digest.topGapConcept && (
              <p className="mt-2 text-[11px] text-text-muted">
                Top gap: <span className="font-semibold text-text-main">{digest.topGapConcept}</span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
