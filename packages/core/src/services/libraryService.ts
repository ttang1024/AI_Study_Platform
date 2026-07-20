import type { HttpClient } from '../http';
import type { Document } from '../types';
import type { VideoSourceType } from '../videoSources';
import { mapDocument, type BackendDocument } from './documentService';
import type { VideoListItem } from './videoService';

/**
 * Unified library row from GET /api/library — either a document or a video.
 * Field superset of what web and rn read. Both apps now share the Document /
 * VideoListItem DTOs, so `mapLibraryItem` below is the standard row mapper;
 * `createLibraryService` stays generic for callers that want a custom shape.
 */
export interface BackendLibraryItem {
  kind: 'document' | 'video';
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  createdAt: string;
  // document fields
  fileName?: string | null;
  blobUrl?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  fileHash?: string | null;
  originalUrl?: string | null;
  summary?: string | null;
  // video fields
  title?: string | null;
  videoId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  sourceType?: string | null;
}

export interface PagedLibraryOf<TEntry> {
  items: TEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type LibraryFilterType = 'all' | 'documents' | 'articles' | 'audio' | 'videos';

// Normalized shape the library pages render — a document or video row.
export type LibraryEntry =
  | { kind: 'document'; data: Document }
  | { kind: 'video'; data: VideoListItem };

export type PagedLibrary = PagedLibraryOf<LibraryEntry>;

const toDocument = (i: BackendLibraryItem): Document => ({
  ...mapDocument({
    documentId: i.id,
    courseId: i.courseId,
    fileName: i.fileName ?? '',
    blobUrl: i.blobUrl ?? '',
    contentType: i.contentType ?? '',
    fileSize: i.fileSize ?? 0,
    fileHash: i.fileHash ?? undefined,
    originalUrl: i.originalUrl ?? undefined,
    summary: i.summary ?? undefined,
    createdAt: i.createdAt,
  } satisfies BackendDocument),
  // Library rows carry course labeling the per-course document endpoints don't.
  courseName: i.courseName,
  courseColor: i.courseColor,
});

const toVideo = (i: BackendLibraryItem): VideoListItem => ({
  id: i.id,
  courseId: i.courseId,
  courseName: i.courseName,
  courseColor: i.courseColor,
  videoId: i.videoId ?? '',
  videoUrl: i.videoUrl ?? '',
  sourceType: (i.sourceType as VideoSourceType | null) ?? 'youtube',
  title: i.title ?? '',
  thumbnailUrl: i.thumbnailUrl ?? '',
  summary: null,
  noteContent: null,
  flashcardsJson: null,
  quizJson: null,
  createdAt: i.createdAt,
});

export const mapLibraryItem = (i: BackendLibraryItem): LibraryEntry =>
  i.kind === 'video'
    ? { kind: 'video', data: toVideo(i) }
    : { kind: 'document', data: toDocument(i) };

export interface GetLibraryParams {
  type?: LibraryFilterType;
  courseId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function createLibraryService<TEntry>(
  http: HttpClient,
  mapItem: (item: BackendLibraryItem) => TEntry,
) {
  const service = {
    // One page of the merged documents+videos list, filtered/sorted/paginated server-side.
    async getLibrary(params: GetLibraryParams = {}): Promise<PagedLibraryOf<TEntry>> {
      const p = new URLSearchParams({
        type: params.type ?? 'all',
        page: String(params.page ?? 1),
        pageSize: String(params.pageSize ?? 8),
      });
      if (params.courseId) p.set('courseId', params.courseId);
      if (params.search) p.set('search', params.search);

      const response = await http.get<{
        data: PagedLibraryOf<BackendLibraryItem>;
      }>(`/api/library?${p}`);
      const data = response.data.data;
      return {
        items: data.items.map(mapItem),
        totalCount: data.totalCount,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      };
    },

    /**
     * Fetch every entry of a type by paging through the server (pageSize caps
     * at 100). Used for client-side duplicate detection of pasted links in the
     * summarizer.
     */
    async getAllByType(type: LibraryFilterType, courseId?: string | null): Promise<TEntry[]> {
      const pageSize = 100;
      const first = await service.getLibrary({ type, courseId, page: 1, pageSize });
      const all = [...first.items];
      for (let page = 2; page <= first.totalPages; page++) {
        const next = await service.getLibrary({ type, courseId, page, pageSize });
        all.push(...next.items);
      }
      return all;
    },
  };
  return service;
}

export type LibraryService<TEntry> = ReturnType<typeof createLibraryService<TEntry>>;
