import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, RotateCcw, Trash2, Sparkles, ChevronDown, ChevronUp,
  ExternalLink, X, Loader2, Layers,
} from 'lucide-react';
import { mistakesService, type Mistake, type VariantQuestion } from '../../services/mistakesService';
import { isQuizOptionCorrect } from '../../utils/quizAnswers';
import { TimedExamModal } from './TimedExamModal';
import type { QuizQuestion } from '../../types';
import { cn } from '../../utils/cn';

type Filter = 'all' | 'open' | 'resolved';

const VariantsModal: React.FC<{ mistake: Mistake; onClose: () => void }> = ({ mistake, onClose }) => {
  const [variants, setVariants] = useState<VariantQuestion[] | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Record<number, string>>({});

  useEffect(() => {
    mistakesService.generateVariants(mistake.id)
      .then(setVariants)
      .catch((e) => setError(e?.response?.data?.message ?? 'Failed to generate variants.'));
  }, [mistake.id]);

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-[8%] bottom-[8%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[640px] z-[9999] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-teal-600" />
            <h2 className="text-sm font-bold text-text-main">Practice the same concept</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!variants && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-sm">Generating practice variants…</p>
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {variants?.map((v, i) => {
            const chosen = picked[i];
            return (
              <div key={i} className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-medium text-text-main mb-3">{i + 1}. {v.question}</p>
                <div className="space-y-2">
                  {v.options.map((opt) => {
                    const isCorrect = isQuizOptionCorrect(opt, v.correctAnswer);
                    const isChosen = chosen === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setPicked((p) => ({ ...p, [i]: opt }))}
                        disabled={!!chosen}
                        className={cn(
                          'w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors',
                          chosen
                            ? isCorrect
                              ? 'border-green-300 bg-green-50 text-green-800'
                              : isChosen
                                ? 'border-red-300 bg-red-50 text-red-700'
                                : 'border-gray-100 text-gray-400'
                            : 'border-gray-200 hover:border-teal-300 hover:bg-teal-50/50 text-gray-700',
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {chosen && v.explanation && (
                  <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{v.explanation}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

const MistakeCard: React.FC<{
  mistake: Mistake;
  onResolve: (m: Mistake, resolved: boolean) => void;
  onDelete: (m: Mistake) => void;
  onPractice: (m: Mistake) => void;
}> = ({ mistake, onResolve, onDelete, onPractice }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const isOpen = mistake.status === 'open';

  const sourceUrl = mistake.documentId
    ? `/documents/${mistake.documentId}`
    : mistake.videoId
      ? `/videos/${mistake.videoId}`
      : null;

  return (
    <div className={cn(
      'bg-white border rounded-xl overflow-hidden transition-colors',
      isOpen ? 'border-gray-200' : 'border-gray-100 opacity-75',
    )}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {isOpen ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                  Missed ×{mistake.timesMissed}
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                  Resolved
                </span>
              )}
              <span className="text-[11px] text-gray-400">
                last missed {new Date(mistake.lastMissedAt).toLocaleDateString()}
              </span>
              {sourceUrl && (
                <button
                  onClick={() => navigate(sourceUrl)}
                  className="text-[11px] text-teal-600 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink size={10} /> source
                </button>
              )}
            </div>
            <p className="text-sm font-medium text-text-main">{mistake.question}</p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2">
            {mistake.options.map((opt) => {
              const correct = isQuizOptionCorrect(opt, mistake.correctAnswer);
              const yours = isQuizOptionCorrect(opt, mistake.userAnswer);
              return (
                <div
                  key={opt}
                  className={cn(
                    'text-sm px-3 py-2 rounded-lg border',
                    correct
                      ? 'border-green-300 bg-green-50 text-green-800'
                      : yours
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-gray-100 text-gray-500',
                  )}
                >
                  {opt}
                  {correct && <span className="ml-2 text-[11px] font-semibold">✓ correct</span>}
                  {yours && !correct && <span className="ml-2 text-[11px] font-semibold">your answer</span>}
                </div>
              );
            })}
            {mistake.explanation && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{mistake.explanation}</p>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onPractice(mistake)}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Sparkles size={12} /> Practice variants
          </button>
          {isOpen ? (
            <button
              onClick={() => onResolve(mistake, true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors"
            >
              <CheckCircle2 size={12} /> Mark resolved
            </button>
          ) : (
            <button
              onClick={() => onResolve(mistake, false)}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors"
            >
              <RotateCcw size={12} /> Reopen
            </button>
          )}
          {mistake.flashcardId && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded-lg"
              title="This mistake is a flashcard and is scheduled by spaced repetition"
            >
              <Layers size={11} /> Flashcard
            </span>
          )}
          <button
            onClick={() => onDelete(mistake)}
            className="ml-auto p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * The server-backed mistake notebook: wrong quiz answers auto-collected on submission,
 * with resolve/reopen tracking, AI practice variants, and a retry-all timed exam.
 * Rendered as the "Review Mistakes" tab of the Quiz Center.
 */
export const MistakesNotebook: React.FC = () => {
  const [data, setData] = useState<{ items: Mistake[]; openCount: number; resolvedCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('open');
  const [practicing, setPracticing] = useState<Mistake | null>(null);
  const [retryQuestions, setRetryQuestions] = useState<QuizQuestion[]>([]);
  const [promoting, setPromoting] = useState(false);
  const [promoteNote, setPromoteNote] = useState<string | null>(null);

  const load = useCallback(() => {
    mistakesService.getMistakes()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (m: Mistake, resolved: boolean) => {
    try {
      await mistakesService.setStatus(m.id, resolved ? 'resolved' : 'open');
      load();
    } catch { /* keep current state on failure */ }
  };

  const handleDelete = async (m: Mistake) => {
    try {
      await mistakesService.deleteMistake(m.id);
      load();
    } catch { /* keep current state on failure */ }
  };

  const openMistakes = useMemo(() => (data?.items ?? []).filter((m) => m.status === 'open'), [data]);

  // Only the open mistakes that aren't already cards — the button is pointless if there's nothing new
  // to promote, and saying so up front beats a request that comes back "0 created".
  const promotable = useMemo(() => openMistakes.filter((m) => !m.flashcardId), [openMistakes]);

  const handlePromote = async () => {
    setPromoting(true);
    setPromoteNote(null);
    try {
      const result = await mistakesService.promoteToFlashcards();
      setPromoteNote(
        result.created > 0
          ? `Added ${result.created} flashcard${result.created === 1 ? '' : 's'} — due for review now.`
          : 'Every open mistake already has a flashcard.',
      );
      load(); // refresh so the promoted rows show their "flashcard" badge
    } catch {
      setPromoteNote('Could not create flashcards.');
    } finally {
      setPromoting(false);
    }
  };

  const handleRetryAll = () => {
    setRetryQuestions(openMistakes.slice(0, 50).map((m) => ({
      id: m.quizId ?? m.id,
      question: m.question,
      options: m.options.length > 0 ? m.options : undefined,
      correctAnswer: m.correctAnswer,
      explanation: m.explanation,
      type: m.options.length > 0 ? 'multiple-choice' as const : 'short-answer' as const,
    })));
  };

  const items = (data?.items ?? []).filter((m) => filter === 'all' || m.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {([['open', `Open (${data?.openCount ?? 0})`], ['resolved', `Resolved (${data?.resolvedCount ?? 0})`], ['all', 'All']] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
              filter === f
                ? 'bg-teal-600 text-white border-teal-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {label}
          </button>
        ))}
        {/* Promoting hands the question to FSRS, which is the thing that actually schedules repeat
            exposure — a one-off retry does not. */}
        <button
          onClick={handlePromote}
          disabled={promoting || promotable.length === 0}
          title={
            promotable.length === 0
              ? 'Every open mistake already has a flashcard'
              : 'Create flashcards from these mistakes, due for review now'
          }
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          {promoting ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />}
          {promotable.length > 0 ? `Make ${promotable.length} flashcard${promotable.length === 1 ? '' : 's'}` : 'Make flashcards'}
        </button>
        <button
          onClick={handleRetryAll}
          disabled={openMistakes.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <RotateCcw size={12} /> Retry all open
        </button>
      </div>

      {promoteNote && (
        <p className="text-xs text-text-muted bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {promoteNote}
        </p>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <CheckCircle2 size={28} className="mx-auto text-green-400 mb-3" />
          <p className="text-sm font-medium text-text-main">
            {filter === 'open' ? 'No open mistakes — nice work!' : 'Nothing here yet.'}
          </p>
          <p className="text-xs text-text-muted mt-1">
            Take quizzes on your materials; wrong answers are collected here automatically and
            resolve themselves when you answer them correctly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <MistakeCard
              key={m.id}
              mistake={m}
              onResolve={handleResolve}
              onDelete={handleDelete}
              onPractice={setPracticing}
            />
          ))}
        </div>
      )}

      {practicing && <VariantsModal mistake={practicing} onClose={() => setPracticing(null)} />}

      <TimedExamModal
        isOpen={retryQuestions.length > 0}
        onClose={() => { setRetryQuestions([]); load(); }}
        questions={retryQuestions}
        sourceTitle="Mistake Notebook"
        timeLimitMinutes={Math.max(5, Math.ceil(retryQuestions.length * 1.5))}
      />
    </div>
  );
};
