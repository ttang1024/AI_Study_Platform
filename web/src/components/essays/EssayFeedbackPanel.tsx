import React from 'react';
import { ThumbsUp, Wrench } from 'lucide-react';
import type { EssayFeedback } from '../../services/essayService';

interface Props {
  feedback: EssayFeedback;
  scorePercent?: number;
}

const bandTone = (percent: number): string =>
  percent >= 80
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
    : percent >= 60
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';

/**
 * Rubric feedback on one draft.
 *
 * Every strength and improvement is rendered with the passage it refers to, because the prompt
 * requires a verbatim quotation for each. Showing the quote is what makes the feedback checkable —
 * a comment the reader cannot locate in their own writing is not actionable.
 */
export const EssayFeedbackPanel: React.FC<Props> = ({ feedback, scorePercent }) => (
  <div className="space-y-6">
    {(scorePercent !== undefined || feedback.overallComment) && (
      <div className="rounded-xl border border-border p-4">
        {scorePercent !== undefined && (
          <span className={`inline-block px-2.5 py-1 rounded-full text-sm font-semibold ${bandTone(scorePercent)}`}>
            {scorePercent}%
          </span>
        )}
        {feedback.overallComment && (
          <p className="mt-2 text-sm text-text-main leading-relaxed">{feedback.overallComment}</p>
        )}
      </div>
    )}

    {feedback.criteria && feedback.criteria.length > 0 && (
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">By criterion</h3>
        <div className="space-y-3">
          {feedback.criteria.map((c) => {
            const percent = c.maxPoints > 0 ? Math.round((100 * c.score) / c.maxPoints) : 0;
            return (
              <div key={c.name} className="rounded-lg border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-text-main text-sm">{c.name}</span>
                  <span className="text-sm text-text-muted">
                    {c.score} / {c.maxPoints}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-surface-hover overflow-hidden">
                  <div
                    className={percent >= 60 ? 'h-full bg-emerald-500' : 'h-full bg-red-500'}
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                  />
                </div>
                {c.comment && <p className="mt-2 text-xs text-text-muted">{c.comment}</p>}
                {c.toImprove && (
                  <p className="mt-1.5 text-xs text-teal-700 dark:text-teal-400">
                    <span className="font-medium">To improve: </span>
                    {c.toImprove}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    )}

    {feedback.strengths && feedback.strengths.length > 0 && (
      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-text-muted mb-2">
          <ThumbsUp className="w-3.5 h-3.5" /> What worked
        </h3>
        <ul className="space-y-2.5">
          {feedback.strengths.map((s, i) => (
            <li key={i} className="text-sm">
              <p className="text-text-main">{s.point}</p>
              {s.quote && (
                <blockquote className="mt-1 border-l-2 border-emerald-400 pl-2.5 text-xs italic text-text-muted">
                  “{s.quote}”
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      </section>
    )}

    {feedback.improvements && feedback.improvements.length > 0 && (
      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-text-muted mb-2">
          <Wrench className="w-3.5 h-3.5" /> What to change
        </h3>
        <ul className="space-y-2.5">
          {feedback.improvements.map((s, i) => (
            <li key={i} className="text-sm">
              <p className="text-text-main">{s.point}</p>
              {s.quote && (
                <blockquote className="mt-1 border-l-2 border-amber-400 pl-2.5 text-xs italic text-text-muted">
                  “{s.quote}”
                </blockquote>
              )}
              {s.suggestion && <p className="mt-1 text-xs text-teal-700 dark:text-teal-400">{s.suggestion}</p>}
            </li>
          ))}
        </ul>
      </section>
    )}
  </div>
);

export default EssayFeedbackPanel;
