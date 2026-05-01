import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ChevronDown, Star } from 'lucide-react';
import { adminApi } from '../services/api';
import type { FeedbackItem, FeedbackStatus } from '../types';
import { TypeBadge, StatusBadge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { formatRelative } from '../utils/format';
import { cn } from '../utils/cn';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: FeedbackStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'general', label: 'General' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'rating', label: 'Highest rated' },
];

const selectClass =
  'appearance-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 pr-8 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 transition-all cursor-pointer';

export const FeedbackListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') ?? 1);
  const status = (searchParams.get('status') ?? '') as FeedbackStatus | '';
  const type = searchParams.get('type') ?? '';
  const sort = (searchParams.get('sort') ?? 'newest') as 'newest' | 'oldest' | 'rating';
  const search = searchParams.get('search') ?? '';

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(search);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await adminApi.listFeedback({ page, pageSize: PAGE_SIZE, status, type, sort, search });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setError('Failed to load feedback.');
    } finally {
      setIsLoading(false);
    }
  }, [page, status, type, sort, search]);

  useEffect(() => { load(); }, [load]);

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParam('search', searchInput.trim());
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Feedback</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{total} submission{total !== 1 ? 's' : ''} total</p>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search feedback…"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-indigo-500 transition-all"
          />
        </form>

        <div className="relative">
          <select value={status} onChange={(e) => setParam('status', e.target.value)} className={selectClass}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        </div>

        <div className="relative">
          <select value={type} onChange={(e) => setParam('type', e.target.value)} className={selectClass}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        </div>

        <div className="relative">
          <select value={sort} onChange={(e) => setParam('sort', e.target.value)} className={selectClass}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        </div>

        {(status || type || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearchInput(''); setSearchParams({}); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[var(--border-color)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-16 rounded bg-white/5 animate-pulse" />
                <div className="h-4 flex-1 rounded bg-white/5 animate-pulse" />
                <div className="h-4 w-20 rounded bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[var(--text-secondary)]">No feedback found.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {/* Header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              <span>Type</span>
              <span>Subject</span>
              <span>Status</span>
              <span>Rating</span>
              <span>Submitted</span>
            </div>

            {/* Rows */}
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/feedback/${item.id}`}
                className={cn(
                  'grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-6 py-5 text-sm transition-colors hover:bg-white/3',
                  item.status === 'new' && 'bg-indigo-500/3',
                )}
              >
                <TypeBadge type={item.type} />
                <div className="min-w-0">
                  <p className={cn(
                    'truncate font-medium',
                    item.status === 'new' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                  )}>
                    {item.status === 'new' && (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 align-middle" />
                    )}
                    {item.subject}
                  </p>
                  {item.userEmail && (
                    <p className="truncate text-xs text-[var(--text-secondary)] mt-0.5">{item.userEmail}</p>
                  )}
                </div>
                <StatusBadge status={item.status} />
                <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                  {item.rating != null ? (
                    <span className="flex items-center gap-1">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      {item.rating}
                    </span>
                  ) : '—'}
                </span>
                <span className="whitespace-nowrap text-xs text-[var(--text-secondary)]">
                  {formatRelative(item.submittedAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-[var(--text-secondary)]">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParam('page', String(page - 1))}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setParam('page', String(page + 1))}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
