import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookMarked,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Dumbbell,
  ListChecks,
  Loader2,
} from 'lucide-react';
import { DailyStudyQueue, DailyStudyQueueItem, studyQueueService } from '../../services/studyQueueService';

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';

const queueIconMap: Record<DailyStudyQueueItem['type'], React.ElementType> = {
  glossary: BookMarked,
  quiz: Award,
  workedProblem: Dumbbell,
  flashcards: BrainCircuit,
};

export const DailyStudyQueuePanel: React.FC = () => {
  const [queue, setQueue] = useState<DailyStudyQueue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studyQueueService.getDailyQueue(6)
      .then(data => { if (!cancelled) setQueue(data); })
      .catch(() => { if (!cancelled) setQueue(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const topItems = useMemo(() => queue?.items ?? [], [queue]);

  return (
    <div
      className="bg-white rounded-2xl p-5 overflow-hidden"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            <ListChecks size={14} className="text-[var(--primary)]" />
            Daily Queue
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-text-main">Adaptive study plan</h2>
        </div>
        <div className="shrink-0 rounded-xl bg-[var(--bg-app)] px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-text-muted">
            <Clock3 size={12} />
            Today
          </div>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-text-main">
            {queue?.estimatedMinutes ?? 0} min
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin" />
          Building your queue
        </div>
      ) : topItems.length === 0 ? (
        <div className="mt-5 rounded-xl bg-[var(--bg-app)] p-4">
          <p className="text-sm font-semibold text-text-main">Nothing is due right now</p>
          <p className="mt-1 text-sm text-text-muted">Add materials or generate quizzes, flashcards, glossary terms, and worked problems to start adaptive review.</p>
          <Link to="/summarizer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
            Add material
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {topItems.map(item => {
            const Icon = queueIconMap[item.type] ?? ListChecks;
            return (
              <Link
                key={`${item.type}-${item.id}`}
                to={item.actionUrl}
                className="group flex items-center gap-3 rounded-xl border border-black/[0.05] px-3 py-3 transition-colors hover:border-[var(--primary)]/30 hover:bg-[var(--bg-app)]"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${item.courseColor ?? '#0d9488'}18` }}
                >
                  <Icon size={17} style={{ color: item.courseColor ?? 'var(--primary)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-main">{item.title}</p>
                  <p className="truncate text-xs text-text-muted">{item.reason}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-semibold text-text-main">{item.estimatedMinutes} min</p>
                  <p className="max-w-28 truncate text-[11px] text-text-muted">{item.courseName ?? item.sourceName ?? 'Study'}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
