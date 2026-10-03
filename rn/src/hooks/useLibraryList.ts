import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { courseService } from '@/services/courseService';
import { documentService } from '@/services/documentService';
import { libraryService, type LibraryEntry, type LibraryFilterType } from '@/services/libraryService';
import { libraryTagsService, type LibraryTag } from '@/services/libraryTagsService';
import type { AssignSelectionItem } from '@/components/library/LibraryAssignSheet';
import { videoService } from '@/services/videoService';
import type { Course } from '@/types';

export const PAGE_SIZE = 20;

export const TYPE_FILTERS: { id: LibraryFilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'documents', label: 'Documents' },
  { id: 'videos', label: 'Videos' },
  { id: 'articles', label: 'Articles' },
  { id: 'audio', label: 'Audio' },
];

/** Stable identity for a row — documents and videos have separate id spaces. */
export const entryKey = (entry: LibraryEntry) => `${entry.kind}-${entry.data.id}`;

const toSelectionItem = (entry: LibraryEntry): AssignSelectionItem => ({
  ref: { itemKind: entry.kind, itemId: entry.data.id },
  tagIds: entry.tags.map((t) => t.libraryTagId),
});

const isFilterType = (value: string | undefined): value is LibraryFilterType =>
  !!value && TYPE_FILTERS.some((filter) => filter.id === value);

/** A fetched page set, tagged with the query it answers. Keeping the query on
 *  the result is what lets `loading` and `items` be derived below. */
interface Result {
  query: LibraryQuery;
  items: LibraryEntry[];
  totalCount: number;
  page: number;
}

interface LibraryQuery {
  type: LibraryFilterType;
  courseId: string | undefined;
  search: string;
  tagIds: string[];
}

/**
 * Server-paginated library list: filters, debounced search, infinite scroll,
 * pull-to-refresh, and optimistic delete. The screen renders over this.
 */
export function useLibraryList() {
  const router = useRouter();
  const { q, type } = useLocalSearchParams<{ q?: string; type?: string }>();
  const [search, setSearch] = useState(q ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(q ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // Long-pressing a row puts the list in selection mode for bulk tagging. Held as a map keyed by
  // row so the tags each selected item already carries travel with it into the assign sheet.
  const [selection, setSelection] = useState<Map<string, AssignSelectionItem>>(new Map());
  const [assignVisible, setAssignVisible] = useState(false);

  // The route param seeds the filter and the chips override it. The override
  // records which param it was made under, so arriving with a *new* param (e.g.
  // tapping "Videos" on the dashboard) supersedes a stale chip choice. Syncing
  // the two with an effect instead meant a setState in an effect body, which is
  // a cascading render (react-hooks/set-state-in-effect).
  const routeType: LibraryFilterType = isFilterType(type) ? type : 'all';
  const [override, setOverride] = useState<{ base: LibraryFilterType; value: LibraryFilterType } | null>(null);
  const activeType = override?.base === routeType ? override.value : routeType;
  const setActiveType = (value: LibraryFilterType) => setOverride({ base: routeType, value });

  useEffect(() => {
    courseService.getCourses().then(setCourses).catch(() => {});
    // A failed tag fetch leaves the chips empty rather than blanking the library.
    libraryTagsService.getTags().then((res) => setTags(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Keyed on the joined ids rather than the array: `query`'s identity is the staleness check for
  // the fetch below, so a fresh array of the same ids on every render would refetch forever.
  const tagKey = selectedTagIds.join(',');
  const query = useMemo<LibraryQuery>(
    () => ({
      type: activeType,
      courseId: activeCourseId ?? undefined,
      search: debouncedSearch,
      tagIds: tagKey ? tagKey.split(',') : [],
    }),
    [activeType, activeCourseId, debouncedSearch, tagKey],
  );

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);
  }, []);

  // Derived: we're loading exactly while the result we hold answers some other
  // query. `query` is memoized, so the identity check is the staleness check —
  // and it replaces the old request-id ref that guarded against out-of-order
  // responses.
  const loading = result?.query !== query;
  const items = loading ? [] : result.items;
  const totalCount = loading ? 0 : result.totalCount;

  useEffect(() => {
    let cancelled = false;
    libraryService.getLibrary({ ...query, page: 1, pageSize: PAGE_SIZE })
      .then((data) => {
        if (!cancelled) setResult({ query, items: data.items, totalCount: data.totalCount, page: 1 });
      })
      .catch(() => {
        if (!cancelled) setResult({ query, items: [], totalCount: 0, page: 1 });
      });
    return () => { cancelled = true; };
  }, [query]);

  const onEndReached = useCallback(async () => {
    if (loading || loadingMore || !result || result.items.length >= result.totalCount) return;
    const nextPage = result.page + 1;
    setLoadingMore(true);
    try {
      const data = await libraryService.getLibrary({ ...query, page: nextPage, pageSize: PAGE_SIZE });
      // Append only if the filters haven't moved on underneath this request.
      setResult((prev) => (prev?.query === query
        ? { query, items: [...prev.items, ...data.items], totalCount: data.totalCount, page: nextPage }
        : prev));
    } catch {
      // Keep the pages already loaded; the user can pull the list again.
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, result, query]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Re-fetch the first page for the current filters, and resync courses.
      const [data] = await Promise.all([
        libraryService.getLibrary({ ...query, page: 1, pageSize: PAGE_SIZE }),
        courseService.getCourses().then(setCourses).catch(() => {}),
      ]);
      setResult({ query, items: data.items, totalCount: data.totalCount, page: 1 });
    } catch {
      // Leave the existing list in place; the user can pull again.
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  // ── Bulk tagging ──────────────────────────────────────────────────────────

  const toggleSelected = useCallback((entry: LibraryEntry) => {
    setSelection((prev) => {
      const next = new Map(prev);
      const key = entryKey(entry);
      if (next.has(key)) next.delete(key);
      else next.set(key, toSelectionItem(entry));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelection(new Map()), []);

  /**
   * A bulk assign changed server state: reload the first page (so the rows carry their new tags)
   * and the chip counts. Pages loaded past the first are dropped — the same reset `refresh` does.
   */
  const handleAssigned = useCallback(async (message: string) => {
    libraryTagsService.getTags().then((res) => setTags(res.data.data)).catch(() => {});
    try {
      const data = await libraryService.getLibrary({ ...query, page: 1, pageSize: PAGE_SIZE });
      setResult({ query, items: data.items, totalCount: data.totalCount, page: 1 });
      // Re-sync the selection's tag state from what the server just returned, so the sheet's
      // checkmarks describe reality rather than pre-assign state.
      setSelection((prev) => {
        if (prev.size === 0) return prev;
        const next = new Map(prev);
        for (const entry of data.items) {
          const key = entryKey(entry);
          if (next.has(key)) next.set(key, toSelectionItem(entry));
        }
        return next;
      });
    } catch {
      // Leave the list as-is; the assign itself succeeded and a pull-to-refresh will resync.
    }
    Alert.alert('Library updated', message);
  }, [query]);

  const openEntry = useCallback((entry: LibraryEntry) => {
    if (entry.kind === 'document') router.push(`/(tabs)/library/document/${entry.data.id}?courseId=${entry.data.courseId}`);
    else router.push(`/(tabs)/library/video/${entry.data.id}`);
  }, [router]);

  const deleteEntry = useCallback((entry: LibraryEntry) => {
    const title = entry.kind === 'document' ? entry.data.name : entry.data.title;
    Alert.alert(
      'Delete item',
      `Delete "${title}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Remove optimistically so the row disappears the moment it's confirmed.
            setResult((prev) => (prev
              ? {
                  ...prev,
                  items: prev.items.filter((e) => !(e.kind === entry.kind && e.data.id === entry.data.id)),
                  totalCount: Math.max(0, prev.totalCount - 1),
                }
              : prev));
            try {
              // Library documents always carry a courseId (set in libraryService.mapItem).
              if (entry.kind === 'document') await documentService.deleteDocument(entry.data.courseId!, entry.data.id);
              else await videoService.deleteVideo(entry.data.id);
            } catch {
              Alert.alert('Delete failed', 'Could not delete this item. Please try again.');
              // Resync from the server to restore the row we optimistically removed.
              try {
                const data = await libraryService.getLibrary({ ...query, page: 1, pageSize: PAGE_SIZE });
                setResult({ query, items: data.items, totalCount: data.totalCount, page: 1 });
              } catch {
                // Leave the optimistic state; a filter change or reopen will refetch.
              }
            }
          },
        },
      ],
    );
  }, [query]);

  return {
    search, setSearch,
    activeType, setActiveType,
    courses, activeCourseId, setActiveCourseId,
    tags, selectedTagIds, toggleTag,
    loading, items, totalCount, loadingMore, refreshing,
    onEndReached, refresh, openEntry, deleteEntry,
    selection, toggleSelected, clearSelection,
    assignVisible, setAssignVisible, handleAssigned,
  };
}

