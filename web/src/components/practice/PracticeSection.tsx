import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check, X, Clock, Trophy, RotateCcw, ArrowRight, Eye,
  BrainCircuit, Award, BookMarked, Sigma, Play, Layers, ListChecks, GraduationCap, Zap,
} from 'lucide-react';
import {
  practiceService, type PracticeQuestion, type PracticeSource,
  type PracticeResultItem, type PracticeTestSummary,
} from '../../services/practiceService';
import { useStudy } from '../../context/StudyContext';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { CardChart } from '../study/CardChart';

/** Chart flashcards store a ChartDefinition JSON as their answer — render it, don't print it. */
const isChartAnswer = (answer: string) => {
  if (!answer.trimStart().startsWith('{')) return false;
  try {
    const parsed = JSON.parse(answer);
    return !!(parsed?.labels && parsed?.datasets);
  } catch {
    return false;
  }
};

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';

const SOURCE_META: Record<PracticeSource, { label: string; desc: string; icon: React.ElementType; color: string }> = {
  quiz: { label: 'Quiz bank', desc: 'Multiple choice, auto-graded', icon: Award, color: '#d97706' },
  flashcard: { label: 'Flashcards', desc: 'Front → back recall', icon: BrainCircuit, color: '#0d9488' },
  glossary: { label: 'Glossary', desc: 'Term → definition', icon: BookMarked, color: '#2563eb' },
  problem: { label: 'Worked problems', desc: 'Solve & self-check', icon: Sigma, color: '#7c3aed' },
  mistake: { label: 'Mistake redo', desc: 'Questions you previously missed', icon: RotateCcw, color: '#dc2626' },
};
// The configurable test draws from these; 'mistake' only appears inside smart sessions.
const ALL_SOURCES = ['quiz', 'flashcard', 'glossary', 'problem'] as PracticeSource[];

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

type Phase = 'setup' | 'running' | 'report';

export const PracticeSection: React.FC = () => {
  const { courses } = useStudy();
  const [phase, setPhase] = useState<Phase>('setup');

  // ── config ──
  const [count, setCount] = useState(15);
  const [sources, setSources] = useState<Set<PracticeSource>>(new Set(ALL_SOURCES));
  const [courseId, setCourseId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── run state ──
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PracticeResultItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<PracticeTestSummary | null>(null);
  const startRef = useRef(0);

  // Attribute the run to the course the test was scoped to (empty = all courses).
  useStudyTimer({ contextType: 'practice', courseId: courseId || null, enabled: phase === 'running' });

  // Tick the elapsed timer while running.
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const toggleSource = (s: PracticeSource) => {
    setSources(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next.size === 0 ? prev : next; // keep at least one
    });
  };

  const runTest = (test: { questions: PracticeQuestion[] }) => {
    setQuestions(test.questions);
    setIndex(0);
    setResults([]);
    setSelected(null);
    setRevealed(false);
    setElapsed(0);
    startRef.current = Date.now();
    setPhase('running');
  };

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const test = await practiceService.generate({
        count,
        courseId: courseId || null,
        sources: [...sources],
      });
      if (test.questions.length === 0) {
        setError('No material found for that selection. Try adding sources or generating quizzes/flashcards first.');
        setLoading(false);
        return;
      }
      runTest(test);
    } catch {
      setError('Couldn’t build a test right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const [smartLoading, setSmartLoading] = useState(false);
  const startSmartSession = async () => {
    setSmartLoading(true);
    setError(null);
    try {
      const test = await practiceService.generateSmartSession();
      if (test.questions.length === 0) {
        setError('Nothing due right now — no waiting reviews, open mistakes, or unmastered terms. Nice work!');
        return;
      }
      runTest(test);
    } catch {
      setError('Couldn’t build your smart session right now. Please try again.');
    } finally {
      setSmartLoading(false);
    }
  };

  // Deep link: /practice?smart=1 starts the smart session directly
  // (used by the dashboard hero button; old /insights?tab=practice links redirect here).
  const [searchParams] = useSearchParams();
  const smartAutostartRef = useRef(false);
  useEffect(() => {
    if (searchParams.get('smart') === '1' && !smartAutostartRef.current) {
      smartAutostartRef.current = true;
      void startSmartSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const current = questions[index];

  const grade = (isCorrect: boolean) => {
    setResults(prev => [...prev, { source: current.source, sourceId: current.sourceId, isCorrect }]);
    setRevealed(true);
  };

  const onPickOption = (opt: string) => {
    if (revealed) return;
    setSelected(opt);
    grade(opt === current.answer);
  };

  const next = async (finalResults: PracticeResultItem[]) => {
    if (index + 1 < questions.length) {
      setIndex(i => i + 1);
      setSelected(null);
      setRevealed(false);
      return;
    }
    // Finished — persist and show report.
    setPhase('report');
    try {
      setSummary(await practiceService.submit(finalResults));
    } catch {
      // Even if persistence fails, show the locally-computed report.
      const correct = finalResults.filter(r => r.isCorrect).length;
      setSummary({ total: finalResults.length, correct, accuracyPercent: finalResults.length ? Math.round(correct * 1000 / finalResults.length) / 10 : 0 });
    }
  };

  const restart = () => {
    setPhase('setup');
    setQuestions([]);
    setSummary(null);
    setResults([]);
  };

  // ─── Setup ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
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
            onClick={startSmartSession}
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
              onClick={start}
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
  }

  // ─── Report ─────────────────────────────────────────────────────────────────
  if (phase === 'report') {
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
          <button onClick={restart} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-white py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity">
            <RotateCcw size={16} /> New test
          </button>
          <Link to="/dashboard" className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white text-text-main py-3.5 text-[15px] font-bold hover:-translate-y-px transition-transform" style={{ boxShadow: CARD_SHADOW }}>
            Today’s plan <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  // ─── Running (centered for readability) ──────────────────────────────────────
  const meta = SOURCE_META[current.source];
  const SourceIcon = meta.icon;
  const progress = ((index) / questions.length) * 100;
  const isLast = index + 1 >= questions.length;

  return (
    <div className="max-w-3xl mx-auto w-full">
      {/* Header strip */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
          <motion.div className="h-full rounded-full bg-[var(--primary)]" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
        <span className="text-[13px] font-semibold tabular-nums text-text-muted">{index + 1}/{questions.length}</span>
        <span className="flex items-center gap-1 text-[13px] font-semibold tabular-nums text-text-muted"><Clock size={14} /> {formatTime(elapsed)}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl p-6 sm:p-8" style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${meta.color}14`, color: meta.color }}>
              <SourceIcon size={12} /> {meta.label}
            </span>
          </div>

          <p className="text-[19px] font-semibold text-text-main leading-snug whitespace-pre-wrap">{current.prompt}</p>

          {/* Multiple choice */}
          {current.format === 'mc' && current.options && (
            <div className="space-y-2.5 mt-5">
              {current.options.map(opt => {
                const isAnswer = opt === current.answer;
                const isPicked = opt === selected;
                let cls = 'border-transparent bg-zinc-50 hover:border-zinc-200';
                if (revealed && isAnswer) cls = 'border-emerald-400 bg-emerald-50';
                else if (revealed && isPicked) cls = 'border-red-300 bg-red-50';
                return (
                  <button
                    key={opt}
                    onClick={() => onPickOption(opt)}
                    disabled={revealed}
                    className={`w-full text-left flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-[14px] text-text-main transition-all ${cls}`}
                  >
                    <span className="flex-1">{opt}</span>
                    {revealed && isAnswer && <Check size={16} className="text-emerald-500 shrink-0" />}
                    {revealed && isPicked && !isAnswer && <X size={16} className="text-red-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Recall (self-graded) */}
          {current.format === 'recall' && (
            <div className="mt-5">
              {!revealed ? (
                <button
                  onClick={() => setRevealed(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 py-4 text-[14px] font-semibold text-text-muted hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all"
                >
                  <Eye size={16} /> Show answer
                </button>
              ) : (
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">Answer</p>
                  {isChartAnswer(current.answer) ? (
                    <CardChart data={current.answer} />
                  ) : (
                    <p className="text-[15px] text-text-main whitespace-pre-wrap">{current.answer}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Explanation */}
          {revealed && current.explanation && (
            <div className="mt-4 rounded-xl bg-blue-50/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500 mb-1">Explanation</p>
              <p className="text-[13px] text-text-main whitespace-pre-wrap">{current.explanation}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Action bar */}
      <div className="mt-5">
        {!revealed && current.format === 'recall' && (
          <p className="text-center text-[13px] text-text-muted">Reveal the answer, then rate yourself.</p>
        )}
        {!revealed && current.format === 'mc' && (
          <p className="text-center text-[13px] text-text-muted">Pick an answer to continue.</p>
        )}
        {revealed && current.format === 'recall' && results.length <= index && (
          <div className="flex gap-3">
            <button onClick={() => grade(false)} className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-red-200 text-red-500 py-3.5 text-[15px] font-bold hover:bg-red-50 transition-colors">
              <X size={16} /> Missed it
            </button>
            <button onClick={() => grade(true)} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-white py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity">
              <Check size={16} /> Got it
            </button>
          </div>
        )}
        {revealed && results.length > index && (
          <button
            onClick={() => next(results)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-white py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity"
          >
            {isLast ? 'Finish & see results' : 'Next question'} <ArrowRight size={16} />
          </button>
        )}
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
