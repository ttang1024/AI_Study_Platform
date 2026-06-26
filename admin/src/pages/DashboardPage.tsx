import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Bug, Lightbulb, Star, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import { adminApi } from '../services/api';
import type { FeedbackStats } from '../types';
import { StatCard } from '../components/common/StatCard';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getFeedbackStats()
      .then(setStats)
      .catch(() => setError('Failed to load stats.'));
  }, []);

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Overview of user-submitted feedback</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!stats && !error && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] animate-pulse" />
          ))}
        </div>
      )}

      {stats && (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 mb-5">
            <StatCard
              label="Total Feedback"
              value={stats.total}
              icon={MessageSquare}
              iconColor="text-emerald-600"
            />
            <StatCard
              label="New (unread)"
              value={stats.byStatus.new ?? 0}
              icon={Clock}
              iconColor="text-emerald-600"
              delta={stats.recentCount > 0 ? `+${stats.recentCount} this week` : undefined}
              deltaPositive
            />
            <StatCard
              label="In Progress"
              value={stats.byStatus.in_progress ?? 0}
              icon={TrendingUp}
              iconColor="text-amber-600"
            />
            <StatCard
              label="Avg. Rating"
              value={stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
              icon={Star}
              iconColor="text-amber-600"
            />
          </div>

          {/* By type */}
          <div className="grid grid-cols-3 gap-5 mb-10">
            <StatCard
              label="Bug Reports"
              value={stats.byType.bug ?? 0}
              icon={Bug}
              iconColor="text-red-600"
            />
            <StatCard
              label="Feature Requests"
              value={stats.byType.feature ?? 0}
              icon={Lightbulb}
              iconColor="text-amber-600"
            />
            <StatCard
              label="General"
              value={stats.byType.general ?? 0}
              icon={MessageSquare}
              iconColor="text-sky-600"
            />
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-7">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/analytics"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/15 transition-colors"
              >
                <BarChart3 size={14} />
                View platform analytics
              </Link>
              <Link
                to="/feedback?status=new"
                className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-500/15 transition-colors"
              >
                <Clock size={14} />
                View new submissions ({stats.byStatus.new ?? 0})
              </Link>
              <Link
                to="/feedback?type=bug"
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/15 transition-colors"
              >
                <Bug size={14} />
                View bug reports ({stats.byType.bug ?? 0})
              </Link>
              <Link
                to="/feedback"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 transition-colors"
              >
                <MessageSquare size={14} />
                All feedback
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
