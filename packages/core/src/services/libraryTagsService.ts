import type { HttpClient } from '../http';

/**
 * Tags and collections are the same row, told apart by `kind` — a tag renders as a chip, a
 * collection as a folder with a description.
 */
export type LibraryTagKind = 'tag' | 'collection';

export interface LibraryTag {
  libraryTagId: string;
  name: string;
  kind: LibraryTagKind;
  color: string | null;
  description: string | null;
  itemCount: number;
  createdAt: string;
}

/** How the polymorphic join addresses a library item. */
export interface LibraryItemRef {
  itemKind: 'document' | 'video';
  itemId: string;
}

export interface BulkTagResult {
  changed: number;
  requested: number;
}

export interface SavedLibraryView {
  savedLibraryViewId: string;
  name: string;
  icon: string | null;
  filtersJson: string;
  position: number;
  createdAt: string;
}

/** The filter shape stored in a saved view — the same parameters the library list accepts. */
export interface SavedViewFilters {
  type?: string;
  courseId?: string | null;
  search?: string | null;
  tagIds?: string[];
}

export function parseSavedViewFilters(json: string): SavedViewFilters {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // A view whose filters cannot be read still renders — it just applies nothing, which is far
    // better than a corrupt row taking down the library sidebar.
    return {};
  }
}

export function createLibraryTagsService(http: HttpClient) {
  return {
    getTags: (kind?: LibraryTagKind) =>
      http.get<{ data: LibraryTag[] }>('/api/library/tags', {
        params: kind ? { kind } : undefined,
      }),

    createTag: (input: {
      name: string;
      kind: LibraryTagKind;
      color?: string | null;
      description?: string | null;
    }) => http.post<{ data: LibraryTag; message: string }>('/api/library/tags', input),

    updateTag: (
      id: string,
      input: { name: string; color?: string | null; description?: string | null },
    ) => http.put<{ data: LibraryTag; message: string }>(`/api/library/tags/${id}`, input),

    deleteTag: (id: string) =>
      http.delete<{ success: boolean; message: string }>(`/api/library/tags/${id}`),

    /** Bulk-adds a tag to a multi-selection. Items already tagged are skipped, not rejected. */
    assignItems: (id: string, items: LibraryItemRef[]) =>
      http.post<{ data: BulkTagResult; message: string }>(`/api/library/tags/${id}/items`, {
        items,
      }),

    /** Removes the tag from the items. The items themselves are untouched. */
    unassignItems: (id: string, items: LibraryItemRef[]) =>
      http.delete<{ data: BulkTagResult; message: string }>(`/api/library/tags/${id}/items`, {
        data: { items },
      }),

    // ── Saved views ──────────────────────────────────────────────────────
    getViews: () => http.get<{ data: SavedLibraryView[] }>('/api/library/views'),

    createView: (input: {
      name: string;
      icon?: string | null;
      filtersJson: string;
      position?: number;
    }) => http.post<{ data: SavedLibraryView; message: string }>('/api/library/views', input),

    updateView: (
      id: string,
      input: { name: string; icon?: string | null; filtersJson: string; position?: number },
    ) => http.put<{ data: SavedLibraryView; message: string }>(`/api/library/views/${id}`, input),

    deleteView: (id: string) =>
      http.delete<{ success: boolean; message: string }>(`/api/library/views/${id}`),
  };
}
