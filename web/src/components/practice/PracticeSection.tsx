import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Clock, ArrowRight, Eye } from 'lucide-react';
import {
  practiceService, type PracticeQuestion, type PracticeSource,
  type PracticeResultItem, type PracticeTestSummary,
} from '../../services/practiceService';
import { useStudy } from '../../context/StudyContext';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { CardChart } from '../study/CardChart';
import { CARD_SHADOW, SOURCE_META, ALL_SOURCES, formatTime, isChartAnswer } from './practiceMeta';
import { PracticeSetup } from './PracticeSetup';
import { PracticeReport } from './PracticeReport';

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

  if (phase === 'setup') {
    return (
      <PracticeSetup
        courses={courses}
        count={count}
        setCount={setCount}
        sources={sources}
        toggleSource={toggleSource}
        courseId={courseId}
        setCourseId={setCourseId}
        error={error}
        loading={loading}
        smartLoading={smartLoading}
        onStart={start}
        onStartSmartSession={startSmartSession}
      />
    );
  }

  if (phase === 'report') {
    return (
      <PracticeReport
        summary={summary}
        results={results}
        questions={questions}
        elapsed={elapsed}
        onRestart={restart}
      />
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
