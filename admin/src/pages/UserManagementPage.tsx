import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ChevronDown, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { adminApi } from '../services/api';
import type { UserItem } from '../types';
import { Button } from '../components/common/Button';
import { formatDate, formatRelative } from '../utils/format';
import { cn } from '../utils/cn';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All users' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'admin', label: 'Admins' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

const selectClass =
  'appearance-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 pr-8 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 transition-all cursor-pointer';

export const UserManagementPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') ?? 1);
  const status = searchParams.get('status') ?? '';
  const sort = (searchParams.get('sort') ?? 'newest') as 'newest' | 'oldest';
  const search = searchParams.get('search') ?? '';

  const [items, setItems] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(search);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await adminApi.listUsers({ page, pageSize: PAGE_SIZE, search, status, sort });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setError('Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, [page, status, sort, search]);

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

  const handleToggleActive = async (user: UserItem) => {
    setTogglingId(user.userId);
    try {
      const updated = await adminApi.setUserActive(user.userId, !user.isActive);
      setItems((prev) => prev.map((u) => (u.userId === user.userId ? updated : u)));
    } catch {
      setError(`Failed to ${user.isActive ? 'deactivate' : 'activate'} account.`);
    } finally {
      setTogglingId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Users</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{total} user{total !== 1 ? 's' : ''} total</p>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
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
          <select value={sort} onChange={(e) => setParam('sort', e.target.value)} className={selectClass}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        </div>

        {(status || search) && (
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
                <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-white/5 animate-pulse" />
                  <div className="h-3 w-48 rounded bg-white/5 animate-pulse" />
                </div>
                <div className="h-4 w-16 rounded bg-white/5 animate-pulse" />
                <div className="h-7 w-24 rounded-lg bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[var(--text-secondary)]">No users found.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              <span>User</span>
              <span>Joined</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {/* Rows */}
            {items.map((user) => (
              <div
                key={user.userId}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-4 text-sm"
              >
                {/* User info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    user.isAdmin
                      ? 'bg-indigo-600/20 text-indigo-400'
                      : user.isActive
                        ? 'bg-white/8 text-[var(--text-primary)]'
                        : 'bg-white/4 text-[var(--text-secondary)]',
                  )}>
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={cn(
                        'truncate font-medium',
                        user.isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                      )}>
                        {user.fullName}
                      </p>
                      {user.isAdmin && (
                        <ShieldCheck size={13} className="shrink-0 text-indigo-400" />
                      )}
                    </div>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                  </div>
                </div>

                {/* Joined */}
                <span className="whitespace-nowrap text-xs text-[var(--text-secondary)]" title={formatDate(user.createdAt)}>
                  {formatRelative(user.createdAt)}
                </span>

                {/* Status badge */}
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
                  user.isAdmin
                    ? 'bg-indigo-500/15 text-indigo-400'
                    : user.isActive
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400',
                )}>
                  {user.isAdmin ? 'Admin' : user.isActive ? 'Active' : 'Inactive'}
                </span>

                {/* Action */}
                {user.isAdmin ? (
                  <span className="text-xs text-[var(--text-secondary)] w-24 text-center">—</span>
                ) : (
                  <Button
                    variant={user.isActive ? 'outline' : 'primary'}
                    size="sm"
                    isLoading={togglingId === user.userId}
                    onClick={() => handleToggleActive(user)}
                    className="w-24"
                  >
                    {togglingId !== user.userId && (
                      user.isActive
                        ? <UserX size={13} />
                        : <UserCheck size={13} />
                    )}
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </div>
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
