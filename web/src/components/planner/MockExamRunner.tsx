import React, { useState, useEffect, useRef } from 'react';
import { Timer, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { plannerService, type MockExam, type MockExamResult } from '../../services/plannerService';
import { cn } from '../../utils/cn';

export const MockExamRunner: React.FC<{ exam: MockExam; onDone: () => void }> = ({ exam, onDone }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<MockExamResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (result) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [result]);

  const limitSeconds = exam.suggestedMinutes * 60;
  const remaining = Math.max(0, limitSeconds - elapsed);
  const overTime = elapsed > limitSeconds;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await plannerService.gradeMockExam(answers, Math.floor((Date.now() - startRef.current) / 1000));
      setResult(r);
    } catch { /* leave the runner open so answers aren't lost */ } finally {
      setSubmitting(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (result) {
    const pct = result.total === 0 ? 0 : Math.round((100 * result.score) / result.total);
    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-3xl font-black text-text-main">{result.score} / {result.total}</p>
          <p className={cn('text-sm font-medium mt-1', pct >= 70 ? 'text-green-600' : 'text-amber-600')}>
            {pct}% — {pct >= 90 ? 'exam-ready' : pct >= 70 ? 'almost there' : 'wrong answers were added to your mistake notebook'}
          </p>
          <button
            onClick={onDone}
            className="mt-4 text-xs font-medium border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50"
          >
            Back to planner
          </button>
        </div>
        <div className="space-y-2">
          {result.items.map((item) => (
            <div key={item.quizId} className={cn(
              'bg-white border rounded-xl p-4',
              item.correct ? 'border-green-200' : 'border-red-200',
            )}>
              <div className="flex items-start gap-2">
                {item.correct
                  ? <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                  : <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-main">{item.question}</p>
                  {!item.correct && (
                    <p className="text-xs text-red-500 mt-1">Your answer: {item.userAnswer || '—'} · Correct: {item.correctAnswer}</p>
                  )}
                  {item.explanation && <p className="text-xs text-gray-500 mt-1">{item.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <Timer size={16} className={overTime ? 'text-red-500' : 'text-teal-600'} />
        <span className={cn('font-mono text-sm font-bold', overTime ? 'text-red-500' : 'text-text-main')}>
          {overTime ? `+${fmt(elapsed - limitSeconds)} over` : fmt(remaining)}
        </span>
        <span className="text-xs text-gray-400">
          {Object.keys(answers).length}/{exam.questions.length} answered
        </span>
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers).length === 0}
          className="ml-auto inline-flex items-center gap-1.5 bg-teal-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting && <Loader2 size={12} className="animate-spin" />} Submit exam
        </button>
      </div>

      {exam.questions.map((q, i) => (
        <div key={q.quizId} className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-text-main mb-3">{i + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswers((a) => ({ ...a, [q.quizId]: opt }))}
                className={cn(
                  'w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors',
                  answers[q.quizId] === opt
                    ? 'border-teal-400 bg-teal-50 text-teal-800'
                    : 'border-gray-200 hover:border-teal-200 text-gray-700',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
