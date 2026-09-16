import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Mail, Calendar, Clock, Activity, FileText, BookOpen,
  Youtube, ListChecks, Layers, StickyNote, BookMarked, UserCheck, UserX, CheckCircle2, XCircle,
} from 'lucide-react';
import { adminApi } from '../services/api';
import type { UserDetail } from '../types';
import { Button } from '../components/common/Button';
import { BarTrend } from '../components/common/BarTrend';
import { formatDate, formatRelative, formatMinutes, formatNumber } from '../utils/format';
import { cn } from '../utils/cn';
import { ErrorBanner } from '../components/common/ErrorBanner';

const CONTENT_TILES: { key: keyof UserDetail['content']; label: string; icon: typeof FileText; color: string }[] = [
  { key: 'courses', label: 'Courses', icon: BookOpen, color: 'text-emerald-600' },
  { key: 'documents', label: 'Documents', icon: FileText, color: 'text-sky-600' },
  { key: 'videos', label: 'Videos', icon: Youtube, color: 'text-red-600' },
  { key: 'quizzes', label: 'Quizzes', icon: ListChecks, color: 'text-amber-600' },
  { key: 'flashcards', label: 'Flashcards', icon: Layers, color: 'text-violet-600' },
  { key: 'notes', label: 'Notes', icon: StickyNote, color: 'text-fuchsia-600' },
  { key: 'glossaryTerms', label: 'Glossary', icon: BookMarked, color: 'text-teal-600' },
];

export const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!id) return;
    setError('');
    adminApi.getUserDetail(id)
      .then(setUser)
      .catch(() => setError('Failed to load user.'));
  }, [id]);

  const handleToggleActive = async () => {
    if (!user) return;
    setToggling(true);
    try {
      await adminApi.setUserActive(user.userId, !user.isActive);
      setUser({ ...user, isActive: !user.isActive });
    } catch {
      setError(`Failed to ${user.isActive ? 'deactivate' : 'activate'} account.`);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div>
      <Link to="/users" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors sm:mb-6">
        <ArrowLeft size={15} /> Back to users
      </Link>

      <ErrorBanner error={error} />

      {!user && !error && (
        <div className="space-y-5">
          <div className="h-32 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] animate-pulse" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {user && (
        <>
          {/* Profile header */}
          <div className="mb-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4 sm:flex-1">
                <div className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold sm:h-14 sm:w-14 sm:text-xl',
                  user.isAdmin ? 'bg-emerald-600/10 text-emerald-700' : 'bg-black/5 text-[var(--text-primary)]',
                )}>
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-xl font-bold text-[var(--text-primary)] sm:text-2xl">{user.fullName}</h1>
                    {user.isAdmin && <ShieldCheck size={17} className="shrink-0 text-emerald-700" />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1"><Mail size={12} className="shrink-0" /> <span className="truncate">{user.email}</span></span>
                    <span className="inline-flex items-center gap-1"><Calendar size={12} /> Joined {formatDate(user.createdAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      {user.isEmailVerified
                        ? <><CheckCircle2 size={12} className="text-emerald-600" /> Verified</>
                        : <><XCircle size={12} className="text-amber-600" /> Unverified</>}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                  user.isAdmin ? 'bg-emerald-600/10 text-emerald-700'
                    : user.isActive ? 'bg-emerald-500/15 text-emerald-700' : 'bg-red-500/15 text-red-700',
                )}>
                  {user.isAdmin ? 'Admin' : user.isActive ? 'Active' : 'Inactive'}
                </span>
                {!user.isAdmin && (
                  <Button
                    variant={user.isActive ? 'outline' : 'primary'}
                    size="sm"
                    isLoading={toggling}
                    onClick={handleToggleActive}
                  >
                    {!toggling && (user.isActive ? <UserX size={13} /> : <UserCheck size={13} />)}
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Engagement summary */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
            <Metric icon={Clock} color="text-amber-600" label="Total study time" value={formatMinutes(user.studyMinutesTotal)} />
            <Metric icon={Activity} color="text-emerald-600" label="Study time (30d)" value={formatMinutes(user.studyMinutesLast30Days)} />
            <Metric icon={Calendar} color="text-sky-600" label="Last active" value={user.lastActiveAt ? formatRelative(user.lastActiveAt) : 'Never'} />
            <Metric
              icon={ListChecks}
              color="text-emerald-600"
              label="Quiz submissions"
              value={formatNumber(user.quizSubmissions)}
              sub={user.averageQuizScorePercent != null ? `avg ${user.averageQuizScorePercent}%` : undefined}
            />
          </div>

          {/* Study trend */}
          <div className="mb-6">
            <BarTrend
              title="Study activity"
              subtitle="minutes per day · last 14 days"
              data={user.studyTrendMinutes}
              barClass="bg-amber-500"
              formatValue={(v) => formatMinutes(v)}
            />
          </div>

          {/* Content created */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)] sm:mb-5">Content created</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
              {CONTENT_TILES.map(({ key, label, icon: Icon, color }) => (
                <div key={key} className="rounded-xl border border-[var(--border-color)] bg-black/[0.02] p-3 text-center sm:p-4">
                  <Icon size={18} className={cn('mx-auto mb-2', color)} />
                  <p className="text-lg font-bold text-[var(--text-primary)] sm:text-xl">{formatNumber(user.content[key])}</p>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--text-secondary)] sm:text-[11px]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Metric: React.FC<{ icon: typeof FileText; color: string; label: string; value: string; sub?: string }> = ({
  icon: Icon, color, label, value, sub,
}) => (
  <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:p-5">
    <div className="mb-3 flex items-start justify-between gap-2">
      <span className="text-[10px] font-medium leading-tight text-[var(--text-secondary)] uppercase tracking-wider sm:text-xs">{label}</span>
      <Icon size={15} className={cn('shrink-0', color)} />
    </div>
    <p className="text-xl font-bold text-[var(--text-primary)] leading-none sm:text-2xl">{value}</p>
    {sub && <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{sub}</p>}
  </div>
);
