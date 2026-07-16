import React, { useEffect, useState } from 'react';
import { Target, AlertTriangle } from 'lucide-react';
import { analyticsService, type QuizCalibration } from '../../services/analyticsService';
import { cn } from '../../utils/cn';

/** Above this many points between "sure" and "right", the gap is worth calling out. */
const CONCERNING_GAP = 15;

export const CalibrationSection: React.FC = () => {
  const [data, setData] = useState<QuizCalibration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsService.getQuizCalibration()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  // Nothing rated yet — an empty chart would be noise on the dashboard.
  if (data.ratedAnswers === 0) return null;

  const concerning = data.overconfidenceGap !== null && data.overconfidenceGap >= CONCERNING_GAP;

  return (
    <section className="bg-[var(--bg-sidebar)] rounded-2xl border border-[var(--border-color)] p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Target size={18} className="text-[var(--primary)] mt-0.5 shrink-0" />
        <div>
          <h3 className="text-base font-bold text-text-main">Confidence vs. reality</h3>
          <p className="text-xs text-text-muted mt-0.5">
            How often you were right, grouped by how sure you felt. Based on {data.ratedAnswers} rated{' '}
            {data.ratedAnswers === 1 ? 'answer' : 'answers'}.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {data.bins.map(bin => (
          <div key={bin.level} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold text-text-main">{bin.label}</span>
              <span className="text-text-muted tabular-nums">
                {bin.answered === 0
                  ? 'no answers'
                  : `${bin.correct}/${bin.answered} right · ${bin.accuracyPercent}%`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--border-color)] overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  // A low score in "Confident" is the bad case; a low score in "Guessing" is expected.
                  bin.level === 3 && bin.accuracyPercent < 100 - CONCERNING_GAP
                    ? 'bg-amber-500'
                    : 'bg-[var(--primary)]',
                )}
                style={{ width: `${bin.answered > 0 ? bin.accuracyPercent : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* The headline the feature exists for. A wrong answer you knew was a guess costs nothing; one you
          were sure of is a belief you keep acting on until something corrects it. */}
      {concerning && (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-900">
              You were {data.overconfidenceGap}% overconfident.
            </p>
            <p className="text-xs text-amber-800">
              {data.confidentWrong} {data.confidentWrong === 1 ? 'answer you were sure of was' : 'answers you were sure of were'}{' '}
              wrong. Those are worth more of your time than the ones you already knew you were guessing at.
            </p>
          </div>
        </div>
      )}

      {data.confidentMistakes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
            Sure, but wrong
          </h4>
          <ul className="space-y-2">
            {data.confidentMistakes.slice(0, 5).map(mistake => (
              <li
                key={mistake.quizId}
                className="text-xs p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)]"
              >
                <p className="font-medium text-text-main">{mistake.question}</p>
                <p className="text-text-muted mt-1">
                  You said <span className="text-red-600 font-medium">{mistake.yourAnswer}</span>
                  {' · '}
                  Answer: <span className="text-emerald-700 font-medium">{mistake.correctAnswer}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
