import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookMarked,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircleQuestion,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { MobileFlashcardReview } from '../components/study/MobileFlashcardReview';
import { studyQueueService, WeaknessReviewItem, WeaknessReviewQueue } from '../services/studyQueueService';
import { cn } from '../utils/cn';

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  flashcard: { icon: BrainCircuit, color: '#0d9488', bg: '#ccfbf1', label: 'Flashcard' },
  quiz: { icon: Award, color: '#dc2626', bg: '#fee2e2', label: 'Quiz miss' },
  glossary: { icon: BookMarked, color: '#d97706', bg: '#fef3c7', label: 'Glossary' },
  tutorConcept: { icon: MessageCircleQuestion, color: '#7c3aed', bg: '#ede9fe', label: 'Tutor concept' },
};

const getConfig = (type: string) => typeConfig[type] ?? typeConfig.flashcard;

const ReviewCard: React.FC<{ item: WeaknessReviewItem }> = ({ item }) => {
  const config = getConfig(item.type);
  const Icon = config.icon;

  return (
    <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: config.bg, color: config.color }}>
          <Icon size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ backgroundColor: config.bg, color: config.color }}>
              {config.label}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
              <Clock3 size={12} />
              {item.estimatedMinutes} min
            </span>
          </div>
          <h3 className="mt-2 text-base font-bold leading-snug text-text-main">{item.title}</h3>
          <p className="mt-1 text-sm text-text-muted">{item.reason}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[var(--bg-app)] p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Prompt</p>
        <p className="mt-1 text-sm font-semibold text-text-main">{item.prompt}</p>
        {item.userAnswer && (
          <p className="mt-2 text-sm text-red-600">
            Your answer: <span className="font-semibold">{item.userAnswer}</span>
          </p>
        )}
        {item.answer && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">Show answer</summary>
            <p className="mt-2 text-sm leading-relaxed text-text-main">{item.answer}</p>
          </details>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {item.source.courseName && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{item.source.courseName}</p>
          )}
          {item.source.name && <p className="truncate text-sm text-text-muted">{item.source.name}</p>}
        </div>
        <Link
          to={item.source.actionUrl}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2 text-sm font-semibold text-text-main transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          Open
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
};

export const WeaknessReviewPage: React.FC = () => {
  const [queue, setQueue] = useState<WeaknessReviewQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string>('all');
  const [flashcardReview, setFlashcardReview] = useState<{ id: string; front: string; back: string }[] | null>(null);

  const loadQueue = React.useCallback(() => {
    setLoading(true);
    setError(null);
    studyQueueService.getWeaknessReviewQueue(10)
      .then(setQueue)
      .catch(() => setError('Unable to load your review queue.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const sections = useMemo(() => {
    if (!queue) return [];
    if (activeType === 'all') return queue.sections;
    return queue.sections
      .map(section => ({ ...section, items: section.items.filter(item => item.type === activeType) }))
      .filter(section => section.items.length > 0);
  }, [activeType, queue]);

  const dueFlashcards = useMemo(() => (
    queue?.sections
      .flatMap(section => section.items)
      .filter(item => item.type === 'flashcard' && item.answer)
      .map(item => ({ id: item.id, front: item.prompt, back: item.answer ?? '' })) ?? []
  ), [queue]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    queue?.sections.flatMap(section => section.items).forEach(item => map.set(item.type, (map.get(item.type) ?? 0) + 1));
    return map;
  }, [queue]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            <Sparkles size={15} className="text-[var(--primary)]" />
            Daily Review
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-main">Weakness-based review queue</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Today’s queue combines due flashcards, failed quiz questions, unmastered glossary terms, and repeated AI tutor concepts.
          </p>
        </div>

        {queue && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-2xl font-bold tabular-nums text-text-main">{queue.totalItems}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Items</p>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-2xl font-bold tabular-nums text-text-main">{queue.estimatedMinutes}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Minutes</p>
            </div>
            <button
              onClick={loadQueue}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-sm font-bold text-text-main shadow-sm transition hover:text-[var(--primary)]"
            >
              <RotateCcw size={16} />
              Refresh
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'flashcard', 'quiz', 'glossary', 'tutorConcept'].map(type => {
          const config = type === 'all'
            ? { color: '#334155', bg: '#f1f5f9', label: 'All' }
            : getConfig(type);
          const count = type === 'all' ? queue?.totalItems ?? 0 : counts.get(type) ?? 0;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={cn(
                'rounded-xl px-3 py-2 text-sm font-semibold transition',
                activeType === type ? 'text-white shadow-sm' : 'text-text-muted hover:bg-white',
              )}
              style={activeType === type ? { backgroundColor: config.color } : { backgroundColor: config.bg }}
            >
              {config.label} {count}
            </button>
          );
        })}
        {dueFlashcards.length > 0 && (
          <button
            onClick={() => setFlashcardReview(dueFlashcards)}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white"
          >
            <BrainCircuit size={16} />
            Review due cards
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center gap-2 rounded-2xl bg-white text-sm text-text-muted shadow-sm">
          <Loader2 size={18} className="animate-spin" />
          Building your review queue
        </div>
      ) : error ? (
        <div className="flex min-h-[420px] items-center justify-center gap-2 rounded-2xl bg-white text-sm text-red-600 shadow-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : !queue || queue.totalItems === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl bg-white px-6 text-center shadow-sm">
          <CheckCircle2 size={42} className="text-emerald-500" />
          <h2 className="mt-4 text-xl font-bold text-text-main">No weaknesses due today</h2>
          <p className="mt-2 max-w-md text-sm text-text-muted">Generate flashcards, take quizzes, mark glossary terms, or ask the AI tutor to build a stronger review queue.</p>
          <Link to="/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white">
            Back to dashboard
            <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <section key={section.type} className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-text-main">{section.title}</h2>
                  <p className="text-sm text-text-muted">{section.description}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-text-muted">{section.items.length} item{section.items.length === 1 ? '' : 's'}</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {section.items.map(item => <ReviewCard key={`${item.type}-${item.id}`} item={item} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {flashcardReview && (
        <MobileFlashcardReview
          cards={flashcardReview}
          title="Due flashcards"
          onClose={() => setFlashcardReview(null)}
        />
      )}
    </div>
  );
};
