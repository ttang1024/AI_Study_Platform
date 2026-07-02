import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, RotateCcw, ArrowRight } from 'lucide-react';
import type {
  PracticeQuestion, PracticeResultItem, PracticeTestSummary,
} from '../../services/practiceService';
import { CARD_SHADOW, SOURCE_META, ALL_SOURCES, formatTime, isChartAnswer } from './practiceMeta';

interface PracticeReportProps {
  summary: PracticeTestSummary | null;
  results: PracticeResultItem[];
  questions: PracticeQuestion[];
  elapsed: number;
  onRestart: () => void;
}

export const PracticeReport: React.FC<PracticeReportProps> = ({
  summary, results, questions, elapsed, onRestart,
}) => {
  const total = summary?.total ?? results.length;
  const correct = summary?.correct ?? results.filter(r => r.isCorrect).length;
  const pct = summary?.accuracyPercent ?? (total ? Math.round(correct * 1000 / total) / 10 : 0);
  const missed = questions.filter((_, i) => results[i] && !results[i].isCorrect);

  const bySource = ALL_SOURCES.map(s => {
    const items = results.filter(r => r.source === s);
    return { s, total: items.length, correct: items.filter(r => r.isCorrect).length };
  }).filter(x => x.total > 0);

  return (
    <div className="w-full space-y-8">
      {/* Score banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(120deg, #0f766e 0%, #0d9488 45%, #0891b2 100%)' }}
      >
        <Trophy size={200} strokeWidth={0.75} className="pointer-events-none absolute -right-6 -top-10 opacity-[0.12]" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-white/80">Your score</p>
            <p className="text-[64px] font-bold leading-none tabular-nums mt-1">{pct}%</p>
          </div>
          <div className="sm:ml-auto flex gap-6 text-white/90">
            <div><p className="text-[12px] uppercase tracking-wide text-white/70">Correct</p><p className="text-[24px] font-bold tabular-nums">{correct}/{total}</p></div>
            <div><p className="text-[12px] uppercase tracking-wide text-white/70">Time</p><p className="text-[24px] font-bold tabular-nums">{formatTime(elapsed)}</p></div>
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* By source */}
        {bySource.length > 0 && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-0.5">By source</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {bySource.map(({ s, total: t, correct: c }) => {
                const meta = SOURCE_META[s];
                const Icon = meta.icon;
                const ratio = Math.round((c / t) * 100);
                return (
                  <div key={s} className="bg-white rounded-2xl p-4" style={{ boxShadow: CARD_SHADOW }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon size={16} style={{ color: meta.color }} />
                      <span className="text-[13px] font-semibold text-text-main">{meta.label}</span>
                      <span className="ml-auto text-[12px] font-semibold tabular-nums text-text-muted">{c}/{t}</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${ratio}%`, background: meta.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Misses */}
        {missed.length > 0 && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-0.5">Review your misses · {missed.length}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {missed.map(q => {
                const meta = SOURCE_META[q.source];
                return (
                  <div key={q.id} className="relative bg-white rounded-2xl pl-5 pr-4 py-3.5 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
                    <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: meta.color }} />
                    <p className="text-[13px] font-semibold text-text-main line-clamp-2">{q.prompt}</p>
                    <p className="text-[13px] text-[var(--primary)] mt-1 line-clamp-2"><span className="text-text-muted font-medium">Answer:</span> {isChartAnswer(q.answer) ? 'chart card — review it in Flashcards' : q.answer}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div className="flex gap-3 max-w-xl">
        <button onClick={onRestart} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-white py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity">
          <RotateCcw size={16} /> New test
        </button>
        <Link to="/dashboard" className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white text-text-main py-3.5 text-[15px] font-bold hover:-translate-y-px transition-transform" style={{ boxShadow: CARD_SHADOW }}>
          Today’s plan <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
};
