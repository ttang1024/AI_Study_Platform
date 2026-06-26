import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, UserPlus, Clock, Activity, FileText, BookOpen, Youtube,
  ListChecks, Layers, StickyNote, BookMarked, TrendingUp, ChevronRight,
} from 'lucide-react';
import { adminApi } from '../services/api';
import type { PlatformAnalytics } from '../types';
import { StatCard } from '../components/common/StatCard';
import { BarTrend } from '../components/common/BarTrend';
import { formatNumber, formatMinutes, formatRelative } from '../utils/format';
import { cn } from '../utils/cn';

const CONTENT_ROWS: { key: keyof PlatformAnalytics['content']; label: string; icon: typeof FileText; color: string; bar: string }[] = [
  { key: 'documents', label: 'Documents', icon: FileText, color: 'text-sky-600', bar: 'bg-sky-500' },
  { key: 'courses', label: 'Courses', icon: BookOpen, color: 'text-emerald-600', bar: 'bg-emerald-500' },
  { key: 'videos', label: 'Videos', icon: Youtube, color: 'text-red-600', bar: 'bg-red-500' },
  { key: 'quizzes', label: 'Quizzes', icon: ListChecks, color: 'text-amber-600', bar: 'bg-amber-500' },
  { key: 'flashcards', label: 'Flashcards', icon: Layers, color: 'text-violet-600', bar: 'bg-violet-500' },
  { key: 'notes', label: 'Notes', icon: StickyNote, color: 'text-fuchsia-600', bar: 'bg-fuchsia-500' },
  { key: 'glossaryTerms', label: 'Glossary terms', icon: BookMarked, color: 'text-teal-600', bar: 'bg-teal-500' },
];

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getPlatformAnalytics()
      .then(setData)
      .catch(() => setError('Failed to load analytics.'));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] animate-pulse" />
        ))}
      </div>
    );
  }

  const { users, engagement, content, signupTrend, activeUsersTrend, topUsers } = data;
  const maxContent = Math.max(1, ...CONTENT_ROWS.map((r) => content[r.key]));
  const verifiedPct = users.total > 0 ? Math.round((users.verified / users.total) * 100) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Analytics</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Platform-wide usage and engagement</p>
      </div>

      {/* Headline user metrics */}
      <div className="mb-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard label="Total Users" value={formatNumber(users.total)} icon={Users} iconColor="text-emerald-600" />
        <StatCard
          label="Active (30d)"
          value={formatNumber(engagement.mau)}
          icon={Activity}
          iconColor="text-emerald-600"
          delta={users.total > 0 ? `${Math.round((engagement.mau / users.total) * 100)}% of base` : undefined}
          deltaPositive
        />
        <StatCard
          label="New This Week"
          value={formatNumber(users.newLast7Days)}
          icon={UserPlus}
          iconColor="text-sky-600"
          delta={`${formatNumber(users.newLast30Days)} in 30d`}
          deltaPositive={users.newLast7Days > 0}
        />
        <StatCard label="Study Time (30d)" value={formatMinutes(engagement.studyMinutesLast30Days)} icon={Clock} iconColor="text-amber-600" />
      </div>

      {/* Engagement / activity windows */}
      <div className="mb-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard label="Active Today" value={formatNumber(engagement.dau)} icon={Activity} iconColor="text-emerald-600" />
        <StatCard label="Active (7d)" value={formatNumber(engagement.wau)} icon={UserCheck} iconColor="text-emerald-600" />
        <StatCard label="Quiz Subs (30d)" value={formatNumber(engagement.quizSubmissionsLast30Days)} icon={ListChecks} iconColor="text-amber-600" />
        <StatCard
          label="Verified"
          value={`${verifiedPct}%`}
          icon={UserCheck}
          iconColor="text-emerald-600"
          delta={`${formatNumber(users.inactive)} inactive`}
        />
      </div>

      {/* Trend charts */}
      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BarTrend
          title="New signups"
          subtitle={`${formatNumber(users.newLast30Days)} in last 30 days`}
          data={signupTrend}
          barClass="bg-emerald-500"
          formatValue={(v) => `${v} signup${v === 1 ? '' : 's'}`}
        />
        <BarTrend
          title="Daily active users"
          subtitle="last 14 days"
          data={activeUsersTrend}
          barClass="bg-teal-500"
          formatValue={(v) => `${v} active`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Content breakdown */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
          <h3 className="mb-5 text-sm font-semibold text-[var(--text-primary)]">Content library</h3>
          <div className="space-y-3.5">
            {CONTENT_ROWS.map(({ key, label, icon: Icon, color, bar }) => {
              const value = content[key];
              const pct = (value / maxContent) * 100;
              return (
                <div key={key} className="flex items-center gap-3">
                  <Icon size={15} className={cn('shrink-0', color)} />
                  <span className="w-28 shrink-0 text-xs text-[var(--text-secondary)]">{label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
                    <div className={cn('h-full rounded-full', bar)} style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs font-medium text-[var(--text-primary)]">{formatNumber(value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top users */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
          <div className="mb-5 flex items-center gap-2">
            <TrendingUp size={15} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Most active users (30d)</h3>
          </div>
          {topUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">No study activity yet.</p>
          ) : (
            <div className="space-y-1">
              {topUsers.map((u, i) => (
                <Link
                  key={u.userId}
                  to={`/users/${u.userId}`}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-black/5"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-[var(--text-secondary)]">{i + 1}</span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-xs font-semibold text-emerald-700">
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{u.fullName}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{u.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{formatMinutes(u.studyMinutes)}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {u.lastActiveAt ? formatRelative(u.lastActiveAt) : '—'}
                    </p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-[var(--text-secondary)] opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
