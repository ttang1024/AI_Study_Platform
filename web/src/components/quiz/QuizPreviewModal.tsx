import React, { useEffect, useState } from 'react';
import { Loader2, Trophy, X } from 'lucide-react';
import { KnowledgeGraphNode } from '../../services/knowledgeGraphService';
import { questionBankService, QuestionBankQuestion } from '../../services/questionBankService';
import { cn } from '../../utils/cn';

const QUIZ_COLOR = '#16a34a';
const QUIZ_BG = '#dcfce7';

interface Props {
  node: KnowledgeGraphNode;
  onClose: () => void;
}

export const QuizPreviewModal: React.FC<Props> = ({ node, onClose }) => {
  const [questions, setQuestions] = useState<QuestionBankQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const match = node.id.match(/^quiz:(document|video):(.+)$/);
    if (!match) { setLoading(false); return; }
    const [, sourceType, sourceId] = match;
    setQuestions([]);
    setLoading(true);
    let cancelled = false;
    questionBankService.getQuestions()
      .then(all => {
        if (cancelled) return;
        setQuestions(all.filter(q =>
          sourceType === 'document' ? q.documentId === sourceId : q.videoId === sourceId,
        ));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [node.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '82vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-black/[0.06] p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: QUIZ_BG, color: QUIZ_COLOR }}
            >
              <Trophy size={18} />
            </div>
            <div>
              <p className="font-bold text-text-main">{node.title}</p>
              {node.subtitle && <p className="text-xs text-text-muted">{node.subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-lg p-1.5 text-text-muted hover:bg-[var(--bg-app)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
              <Loader2 size={16} className="animate-spin" />
              Loading questions…
            </div>
          ) : questions.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">No questions found for this quiz.</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.quizId} className="rounded-xl border border-black/[0.06] p-4">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-xs font-bold tabular-nums text-text-muted">{i + 1}.</span>
                    <p className="text-sm font-semibold text-text-main">{q.question}</p>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {q.options.map((opt, j) => {
                      const optLetter = opt.match(/^([A-Za-z])\./)?.[1]?.toUpperCase();
                      const isCorrect = optLetter
                        ? optLetter === q.correctAnswer.toUpperCase()
                        : opt === q.correctAnswer;
                      return (
                        <div
                          key={j}
                          className={cn(
                            'rounded-lg bg-[var(--bg-app)] px-3 py-2 text-sm',
                            isCorrect
                              ? 'border border-green-500 font-semibold text-green-700'
                              : 'text-text-muted',
                          )}
                        >
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{q.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
