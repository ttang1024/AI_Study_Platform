import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, CheckCircle2, XCircle, RotateCcw, Trophy, Clock, Award,
} from 'lucide-react';
import { ShareableQuiz } from '../../services/shareContentService';
import { cn } from '../../utils/cn';
import { getCorrectQuizOptionText, isQuizOptionCorrect } from '../../utils/quizAnswers';

type QuizPhase = 'intro' | 'quiz' | 'results';
interface Answer { idx: number; selected: string; correct: boolean; }

export const SharedQuiz: React.FC<{ questions: ShareableQuiz[]; title: string }> = ({ questions, title }) => {
  const [phase, setPhase] = useState<QuizPhase>('intro');
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'quiz') return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(interval);
  }, [phase, startTime]);

  const handleStart = () => { setPhase('quiz'); setStartTime(Date.now()); setCurrent(0); setAnswers([]); setSelected(null); };
  const handleReset = () => { setPhase('intro'); setCurrent(0); setAnswers([]); setSelected(null); setElapsed(0); };

  const handleNext = useCallback(() => {
    if (selected === null) return;
    const q = questions[current];
    const newAnswer: Answer = { idx: current, selected, correct: isQuizOptionCorrect(selected, q.correctAnswer) };
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    setSelected(null);
    if (current + 1 >= questions.length) { setPhase('results'); setElapsed(Date.now() - startTime); }
    else setCurrent(i => i + 1);
  }, [selected, current, answers, questions, startTime]);

  const formatTime = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}m ${s % 60}s`; };
  const score = answers.filter(a => a.correct).length;
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <AnimatePresence mode="wait">
      {phase === 'intro' && (
        <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-8 text-center space-y-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Award size={28} />
          </div>
          <div>
            <h3 className="text-lg font-black text-text-main">{title}</h3>
            <p className="text-text-muted mt-1">{questions.length} questions</p>
          </div>
          <button onClick={handleStart} className="w-full rounded-xl bg-primary py-3 text-sm font-black text-white hover:opacity-90 transition-opacity">
            Start Quiz
          </button>
        </motion.div>
      )}

      {phase === 'quiz' && (
        <motion.div key="quiz" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>{current + 1} / {questions.length}</span>
            <span className="flex items-center gap-1"><Clock size={13} />{formatTime(elapsed)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((current + 1) / questions.length) * 100}%` }} />
          </div>
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-5 space-y-4">
            <p className="text-sm font-bold text-text-main leading-relaxed">{questions[current].question}</p>
            <div className="space-y-2">
              {questions[current].options.map((opt, i) => {
                const isSelected = selected === opt;
                const isCorrect = selected !== null && isQuizOptionCorrect(opt, questions[current].correctAnswer);
                const isWrong = selected !== null && isSelected && !isCorrect;
                return (
                  <button key={i} onClick={() => { if (selected === null) setSelected(opt); }}
                    className={cn(
                      'w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all',
                      selected === null
                        ? 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-primary/50 hover:bg-primary/5'
                        : isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : isWrong ? 'border-red-400 bg-red-50 text-red-700'
                            : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] opacity-50',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      {opt}
                      {isCorrect && <CheckCircle2 size={15} className="ml-auto text-emerald-500" />}
                      {isWrong && <XCircle size={15} className="ml-auto text-red-500" />}
                    </span>
                  </button>
                );
              })}
            </div>
            {selected !== null && questions[current].explanation && (
              <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 text-xs text-teal-700">
                <span className="font-bold">Explanation: </span>{questions[current].explanation}
              </div>
            )}
          </div>
          <button onClick={handleNext} disabled={selected === null}
            className="w-full rounded-xl bg-primary py-3 text-sm font-black text-white disabled:opacity-40 hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            {current + 1 >= questions.length ? 'Finish' : 'Next'}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}

      {phase === 'results' && (
        <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
          <div className={cn('rounded-2xl border p-6 text-center space-y-3',
            pct >= 80 ? 'border-emerald-200 bg-emerald-50' : pct >= 50 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
          )}>
            <Trophy size={36} className={cn('mx-auto', pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500')} />
            <p className={cn('text-4xl font-black', pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600')}>{pct}%</p>
            <p className="text-text-muted text-sm">{score} / {questions.length} correct · {formatTime(elapsed)}</p>
            <button onClick={handleReset} className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-white px-4 py-2 text-sm font-bold text-text-muted hover:border-primary/50 transition-all mx-auto">
              <RotateCcw size={13} /> Try Again
            </button>
          </div>
          <div className="space-y-3">
            {questions.map((q, i) => {
              const ans = answers[i];
              return (
                <div key={i} className={cn('rounded-xl border p-4', ans?.correct ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50')}>
                  <div className="flex items-start gap-3">
                    {ans?.correct ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> : <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-main">{q.question}</p>
                      <p className="text-xs mt-1 text-text-muted">Your answer: <span className={ans?.correct ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{ans?.selected ?? '—'}</span></p>
                      {!ans?.correct && <p className="text-xs mt-0.5 text-text-muted">Correct: <span className="text-emerald-600 font-bold">{getCorrectQuizOptionText(q.options, q.correctAnswer)}</span></p>}
                      {q.explanation && <p className="text-xs text-text-muted mt-1">{q.explanation}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
