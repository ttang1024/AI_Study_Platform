import React from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Clock, CheckCircle2, Share2, Loader2, Play,
} from 'lucide-react';
import { CONTENT_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { cn } from '../../utils/cn';
import { Button } from '../common/Button';

export type QuizItemType = 'doc' | 'article' | 'audio' | 'podcast' | 'video';

interface TypeConfig {
  Icon: React.ElementType;
  iconClass: string;
  defaultBadgeClass: string;
  rowHoverClass: string;
  actionHoverClass: string;
  retakePath: (docId: string, itemId: string) => string;
}

const TYPE_CONFIG: Record<QuizItemType, TypeConfig> = {
  doc: {
    Icon: CONTENT_TYPE_ICONS.document.icon,
    iconClass: 'text-[var(--primary)]',
    defaultBadgeClass: 'bg-zinc-50 text-zinc-500',
    rowHoverClass: 'hover:border-[var(--primary)]/50',
    actionHoverClass: 'hover:border-primary/50 hover:text-primary',
    retakePath: (docId) => `/documents/${docId}`,
  },
  article: {
    Icon: CONTENT_TYPE_ICONS.article.icon,
    iconClass: 'text-blue-500',
    defaultBadgeClass: 'bg-zinc-50 text-zinc-500',
    rowHoverClass: 'hover:border-blue-300',
    actionHoverClass: 'hover:border-blue-300 hover:text-blue-500',
    retakePath: (docId) => `/articles/${docId}`,
  },
  audio: {
    Icon: CONTENT_TYPE_ICONS.audio.icon,
    iconClass: 'text-amber-500',
    defaultBadgeClass: 'bg-zinc-50 text-zinc-500',
    rowHoverClass: 'hover:border-amber-300',
    actionHoverClass: 'hover:border-amber-300 hover:text-amber-500',
    retakePath: (docId) => `/audio/${docId}`,
  },
  podcast: {
    Icon: CONTENT_TYPE_ICONS.podcast.icon,
    iconClass: 'text-rose-500',
    defaultBadgeClass: 'bg-zinc-50 text-zinc-500',
    rowHoverClass: 'hover:border-rose-300',
    actionHoverClass: 'hover:border-rose-300 hover:text-rose-500',
    retakePath: (docId) => `/audio/${docId}`,
  },
  video: {
    Icon: CONTENT_TYPE_ICONS.video.icon,
    iconClass: 'text-red-400',
    defaultBadgeClass: 'bg-red-50 text-red-500',
    rowHoverClass: 'hover:border-red-200',
    actionHoverClass: 'hover:border-red-300 hover:text-red-500',
    retakePath: (_, itemId) => `/videos/${itemId}`,
  },
};

export interface QuizItemRowProps {
  type: QuizItemType;
  /** Submission/record id (used as React key and for video navigation) */
  id: string;
  name: string;
  score?: number;
  total?: number;
  date?: string;
  courseName?: string;
  courseColor?: string;
  /** Document id for non-video types */
  docId?: string;
  /** True when quiz was generated but never submitted yet */
  pending?: boolean;
  /** Id used to match loadingTimedExam state */
  examKey: string;
  loadingTimedExam: string | null;
  retakeState?: Record<string, unknown>;
  onShare?: () => void;
  onExam?: () => void;
}

export const QuizItemRow: React.FC<QuizItemRowProps> = ({
  type, id, name, score, total, date, courseName, courseColor,
  docId, pending, examKey, loadingTimedExam,
  retakeState, onShare, onExam,
}) => {
  const cfg = TYPE_CONFIG[type];
  const { Icon } = cfg;

  const scorePct = score !== undefined && total ? score / total : null;
  const badgeClass = scorePct !== null
    ? scorePct >= 0.8 ? 'bg-emerald-50 text-emerald-600'
      : scorePct >= 0.5 ? 'bg-orange-50 text-orange-600'
        : 'bg-red-50 text-red-600'
    : cfg.defaultBadgeClass;

  const retakePath = cfg.retakePath(docId ?? id, id);

  return (
    <div className={cn(
      'flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-4 shadow-sm transition-all',
      cfg.rowHoverClass,
    )}>
      {/* Left */}
      <div className="flex items-center gap-4 min-w-0">
        <div className={cn('rounded-lg p-2 shrink-0', badgeClass)}>
          {scorePct !== null ? <Award size={20} /> : <Icon size={20} />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon size={14} className={cfg.iconClass} />
            <h3 className="font-semibold text-text-main truncate">{name}</h3>
            {courseName && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: courseColor }}
              >
                {courseName}
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-0.5 text-xs text-text-muted mt-1">
            {date && (
              <span className="flex items-center gap-1">
                <Clock size={12} />{new Date(date).toLocaleDateString()}
              </span>
            )}
            {total && (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} />{total} Questions
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2 sm:ml-4">
        {scorePct !== null && total !== undefined && score !== undefined && (
          <div className="text-right hidden sm:block">
            <p className="text-lg font-bold text-text-main">{score}/{total}</p>
            <p className={cn(
              'text-[10px] font-bold uppercase tracking-wider',
              scorePct >= 0.8 ? 'text-emerald-600'
                : scorePct >= 0.5 ? 'text-orange-600'
                  : 'text-red-600',
            )}>
              {Math.round(scorePct * 100)}%
            </p>
          </div>
        )}

        {!pending && (
          <>
            {onShare && (
              <button
                onClick={onShare}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-2 sm:px-3 py-1.5 text-xs font-bold text-text-muted transition-all',
                  cfg.actionHoverClass,
                )}
                title="Share quiz link"
              >
                <Share2 size={12} />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}

            {onExam && (
              <button
                onClick={onExam}
                disabled={loadingTimedExam === examKey}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-2 sm:px-3 py-1.5 text-xs font-bold text-text-muted transition-all',
                  cfg.actionHoverClass,
                )}
                title="Timed exam"
              >
                {loadingTimedExam === examKey
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Clock size={12} />}
                <span className="hidden sm:inline">Exam</span>
              </button>
            )}
          </>
        )}

        <Link to={retakePath} state={{ activeTab: 'quiz', ...retakeState }}>
          <Button size="sm" variant="outline">
            <Play size={14} className="mr-1 sm:mr-2" />
            {pending ? 'Take Quiz' : 'Retake'}
          </Button>
        </Link>
      </div>
    </div>
  );
};
