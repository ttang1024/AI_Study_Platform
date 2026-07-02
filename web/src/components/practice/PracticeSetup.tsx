import React from 'react';
import {
  Check, Play, Layers, ListChecks, GraduationCap, Zap, BookMarked,
} from 'lucide-react';
import type { PracticeSource } from '../../services/practiceService';
import type { Course } from '../../types';
import { CARD_SHADOW, SOURCE_META, ALL_SOURCES } from './practiceMeta';

interface PracticeSetupProps {
  courses: Course[];
  count: number;
  setCount: (n: number) => void;
  sources: Set<PracticeSource>;
  toggleSource: (s: PracticeSource) => void;
  courseId: string;
  setCourseId: (id: string) => void;
  error: string | null;
  loading: boolean;
  smartLoading: boolean;
  onStart: () => void;
  onStartSmartSession: () => void;
}

export const PracticeSetup: React.FC<PracticeSetupProps> = ({
  courses, count, setCount, sources, toggleSource, courseId, setCourseId,
  error, loading, smartLoading, onStart, onStartSmartSession,
}) => {
  const courseName = courseId ? (courses.find(c => c.id === courseId)?.name ?? 'Selected course') : 'All courses';
  return (
    <div className="w-full space-y-8">
      <div>
        <p className="text-text-muted mt-1 text-[14px]">One timed test, mixed from everything you’ve studied. Results feed your mastery and streak.</p>
      </div>

      {/* One-button daily smart session */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary)]/80 p-6 text-white"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/15 p-2.5 shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <p className="text-[15px] font-bold">Daily smart session</p>
            <p className="text-[12px] text-white/85 mt-0.5 leading-snug max-w-md">
              Due flashcard reviews, mistakes to redo, and weak concepts — auto-picked and interleaved into one short session.
            </p>
          </div>
        </div>
        <button
          onClick={onStartSmartSession}
          disabled={smartLoading}
          className="shrink-0 flex items-center justify-center gap-2 rounded-2xl bg-white text-[var(--primary)] px-6 py-3 text-[14px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {smartLoading ? 'Building…' : <><Play size={15} /> Start now</>}
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* ── Config column ── */}
        <div className="space-y-7">
          {/* Sources */}
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-0.5">Draw from</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {ALL_SOURCES.map(s => {
                const meta = SOURCE_META[s];
                const on = sources.has(s);
                const Icon = meta.icon;
                return (
                  <button
                    key={s}
                    onClick={() => toggleSource(s)}
                    className={`group relative flex flex-col items-start gap-3 rounded-2xl bg-white p-4 text-left border-2 transition-all ${on ? 'border-[var(--primary)]' : 'border-transparent opacity-65 hover:opacity-100'}`}
                    style={{ boxShadow: CARD_SHADOW }}
                  >
                    <div className="flex w-full items-start justify-between">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}14` }}>
                        <Icon size={18} style={{ color: meta.color }} />
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${on ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-zinc-300 text-transparent'}`}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-text-main">{meta.label}</p>
                      <p className="text-[12px] text-text-muted leading-snug mt-0.5">{meta.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Length */}
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-0.5">Length</p>
            <div className="grid grid-cols-4 gap-2.5 max-w-md">
              {[10, 15, 25, 40].map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`rounded-xl py-3.5 text-[15px] font-bold tabular-nums transition-all ${count === n ? 'bg-[var(--primary)] text-white' : 'bg-white text-text-main hover:bg-zinc-50'}`}
                  style={count === n ? undefined : { boxShadow: CARD_SHADOW }}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>

          {/* Course filter */}
          {courses.length > 0 && (
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-0.5">Course</p>
              <select
                value={courseId}
                onChange={e => setCourseId(e.target.value)}
                className="w-full max-w-md rounded-xl bg-white px-4 py-3 text-[14px] font-medium text-text-main outline-none border-2 border-transparent focus:border-[var(--primary)]"
                style={{ boxShadow: CARD_SHADOW }}
              >
                <option value="">All courses</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </section>
          )}
        </div>

        {/* ── Summary / start panel ── */}
        <div className="lg:sticky lg:top-4 rounded-3xl bg-white p-6 space-y-5" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center gap-2">
            <ListChecks size={16} className="text-[var(--primary)]" />
            <p className="text-[13px] font-bold text-text-main">Your test</p>
          </div>

          <div className="space-y-3 text-[13px]">
            <SummaryRow icon={Layers} label="Questions" value={String(count)} />
            <SummaryRow icon={BookMarked} label="Sources" value={`${sources.size} selected`} />
            <SummaryRow icon={GraduationCap} label="Scope" value={courseName} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[...sources].map(s => {
              const meta = SOURCE_META[s];
              return (
                <span key={s} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: `${meta.color}14`, color: meta.color }}>
                  {meta.label}
                </span>
              );
            })}
          </div>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <button
            onClick={onStart}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-white py-4 text-[15px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? 'Building test…' : <><Play size={17} /> Start test</>}
          </button>
          <p className="text-[11px] text-text-muted text-center">Correct answers update your mastery, FSRS schedule, and streak.</p>
        </div>
      </div>
    </div>
  );
};

// ─── Summary panel row ──────────────────────────────────────────────────────────
const SummaryRow: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2.5">
    <Icon size={15} className="text-text-muted shrink-0" />
    <span className="text-text-muted">{label}</span>
    <span className="ml-auto font-semibold text-text-main text-right truncate max-w-[55%]">{value}</span>
  </div>
);
