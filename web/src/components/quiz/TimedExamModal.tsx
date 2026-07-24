import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, X, Trophy, CheckCircle2, XCircle, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react';
import { QuizQuestion } from '../../types';
import { cn } from '../../utils/cn';
import { getCorrectQuizOptionText, isQuizOptionCorrect } from '../../utils/quizAnswers';

interface TimedExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  sourceTitle: string;
  timeLimitMinutes?: number;
  onComplete?: (correctQuestionIds: string[]) => void;
}

type Phase = 'setup' | 'exam' | 'results';

interface Answer {
  questionId: string;
  selected: string;
  correct: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const TimedExamModal: React.FC<TimedExamModalProps> = ({
  isOpen,
  onClose,
  questions,
  sourceTitle,
  timeLimitMinutes = 10,
  onComplete,
}) => {
  const [phase, setPhase] = useState<Phase>('setup');
  const [shuffled, setShuffled] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(timeLimitMinutes * 60);
  const [timeTaken, setTimeTaken] = useState(0);
  const [timeLimit, setTimeLimit] = useState(timeLimitMinutes);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) { setPhase('setup'); setAnswers([]); setCurrentIndex(0); setSelected(null); }
  }, [isOpen]);

  // The tick is a pure decrement — submitting from inside the updater would run
  // against whatever `answers`/`timeRemaining` the closure captured when the exam
  // started (i.e. an empty answer list), and would fire twice under StrictMode.
  useEffect(() => {
    if (phase !== 'exam') return undefined;
    intervalRef.current = setInterval(() => {
      setTimeRemaining(t => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase]);

  const handleAutoSubmit = useCallback(() => {
    setTimeTaken(timeLimit * 60 - timeRemaining);
    setPhase('results');
    onComplete?.(answers.filter(a => a.correct).map(a => a.questionId));
  }, [timeLimit, timeRemaining, answers, onComplete]);

  // Hand off to the submit once the clock actually reaches zero, so it reads the
  // live answers. Leaving 'exam' tears the interval down via the effect above.
  useEffect(() => {
    if (phase === 'exam' && timeRemaining <= 0) handleAutoSubmit();
  }, [phase, timeRemaining, handleAutoSubmit]);

  const handleStart = () => {
    const q = shuffle(questions);
    setShuffled(q);
    setCurrentIndex(0);
    setAnswers([]);
    setSelected(null);
    setTimeTaken(0);
    // Batched with the phase change so the exam header paints the full clock and
    // the zero-check below never sees a previous run's exhausted timer.
    setTimeRemaining(timeLimit * 60);
    setPhase('exam');
  };

  const handleSelect = (opt: string) => {
    setSelected(opt);
  };

  const handleNext = () => {
    if (!selected?.trim()) return;
    const q = shuffled[currentIndex];
    const newAnswers = [...answers, {
      questionId: q.id,
      selected,
      correct: isQuizOptionCorrect(selected, q.correctAnswer),
    }];
    setAnswers(newAnswers);
    setSelected(null);
    if (currentIndex + 1 >= shuffled.length) {
      clearInterval(intervalRef.current!);
      setTimeTaken(timeLimit * 60 - timeRemaining);
      setPhase('results');
      onComplete?.(newAnswers.filter(a => a.correct).map(a => a.questionId));
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const score = answers.filter(a => a.correct).length;
  const pct = shuffled.length > 0 ? Math.round((score / shuffled.length) * 100) : 0;
  const isLowTime = timeRemaining < 60;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between p-5 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Clock size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-widest">Timed Exam Mode</p>
              <p className="text-sm font-bold text-text-main">{sourceTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-red-50 hover:text-red-500 transition-all">
            <X size={18} />
          </button>
        </div>

        {phase === 'exam' && shuffled.length > 0 && (
          <div className="shrink-0 space-y-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-muted">{currentIndex + 1} / {shuffled.length}</div>
              <div className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-black text-lg tabular-nums',
                isLowTime ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary',
              )}>
                <Clock size={16} />
                {formatTime(timeRemaining)}
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', isLowTime ? 'bg-red-500' : 'bg-primary')}
                style={{ width: `${(timeRemaining / (timeLimit * 60)) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="overflow-y-auto p-5">
          <AnimatePresence mode="wait">

            {/* Setup */}
            {phase === 'setup' && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
                  <p className="font-bold text-text-main">{questions.length} Questions</p>
                  <ul className="text-sm text-text-muted space-y-1.5">
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Questions are randomized</li>
                    <li className="flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> No explanations during exam</li>
                    <li className="flex items-center gap-2"><Clock size={14} className="text-primary" /> Auto-submits when time runs out</li>
                  </ul>
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-main block mb-2">Time limit (minutes)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={60}
                      value={timeLimit}
                      onChange={e => setTimeLimit(parseInt(e.target.value, 10))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-lg font-black text-primary w-12 text-center">{timeLimit}m</span>
                  </div>
                </div>
                <button
                  onClick={handleStart}
                  className="w-full rounded-xl bg-primary py-3 text-base font-black text-white hover:opacity-90 transition-opacity"
                >
                  Start Exam
                </button>
              </motion.div>
            )}

            {/* Exam */}
            {phase === 'exam' && shuffled.length > 0 && (
              <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Question */}
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
                  <p className="font-bold text-text-main leading-relaxed mb-4">{shuffled[currentIndex].question}</p>

                  {shuffled[currentIndex].type === 'multiple-choice' && shuffled[currentIndex].options ? (
                    <div className="space-y-2">
                      {shuffled[currentIndex].options!.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelect(opt)}
                          className={cn(
                            'w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all',
                            selected === opt
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-primary/50',
                          )}
                        >
                          <span className="flex items-center gap-3">
                            {opt}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Type your answer..."
                      value={selected ?? ''}
                      onChange={e => setSelected(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  )}
                </div>

                <button
                  onClick={handleNext}
                  disabled={!selected?.trim()}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-black text-white disabled:opacity-40 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  {currentIndex + 1 >= shuffled.length ? 'Submit Exam' : 'Next Question'}
                  <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {/* Results */}
            {phase === 'results' && (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className={cn(
                  'rounded-xl border p-6 text-center',
                  pct >= 80 ? 'border-emerald-200 bg-emerald-50' : pct >= 50 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50',
                )}>
                  <Trophy size={36} className={cn('mx-auto mb-3', pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500')} />
                  <p className={cn('text-4xl font-black', pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600')}>{pct}%</p>
                  <p className="text-text-muted mt-1">{score} / {shuffled.length} correct · {formatTime(timeTaken)} taken</p>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {shuffled.map((q, i) => {
                    const ans = answers.find(a => a.questionId === q.id);
                    return (
                      <div key={q.id} className={cn('rounded-xl border p-3', ans?.correct ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50')}>
                        <div className="flex gap-2">
                          {ans?.correct ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> : <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-text-main">{q.question}</p>
                            {!ans?.correct && (
                              <>
                                <p className="text-[10px] mt-0.5"><span className="text-text-muted">Your: </span><span className="text-red-600 font-bold">{ans?.selected || '—'}</span></p>
                                <p className="text-[10px]"><span className="text-text-muted">Correct: </span><span className="text-emerald-600 font-bold">{getCorrectQuizOptionText(q.options, q.correctAnswer)}</span></p>
                              </>
                            )}
                            {q.explanation && <p className="text-[10px] text-text-muted mt-0.5 italic">{q.explanation}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setPhase('setup')} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] py-2.5 text-sm font-bold text-text-muted hover:border-primary/50 transition-all">
                    <RotateCcw size={14} /> Try Again
                  </button>
                  <button onClick={onClose} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity">
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
