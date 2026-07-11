import { apiClient } from '@/services/apiClient';
import type { Document, VideoListItem } from '@/types';

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.m4b', '.wav', '.ogg', '.aac', '.flac', '.webm', '.opus', '.aiff', '.aif', '.wma', '.amr', '.mka'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.bmp', '.svg'];
const PPT_EXTENSIONS = ['.ppt', '.pptx', '.pptm', '.potx'];

const getDocumentType = (contentType: string, fileName: string): Document['type'] => {
  const name = fileName.toLowerCase();
  if (contentType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (contentType.includes('wordprocessingml') || name.endsWith('.docx')) return 'docx';
  if (contentType === 'text/markdown' || name.endsWith('.md') || name.endsWith('.markdown')) return 'md';
  if (contentType.includes('presentationml') || contentType === 'application/vnd.ms-powerpoint' || PPT_EXTENSIONS.some((e) => name.endsWith(e))) return 'ppt';
  if (contentType === 'application/epub+zip' || name.endsWith('.epub')) return 'epub';
  if (contentType.startsWith('image/') || IMAGE_EXTENSIONS.some((e) => name.endsWith(e))) return 'image';
  if (contentType === 'audio/podcast') return 'podcast';
  if (contentType.startsWith('audio/') || AUDIO_EXTENSIONS.some((e) => name.endsWith(e))) return 'audio';
  return 'txt';
};

interface BackendLibraryItem {
  kind: 'document' | 'video';
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  createdAt: string;
  fileName?: string | null;
  blobUrl?: string | null;
  contentType?: string | null;
  originalUrl?: string | null;
  summary?: string | null;
  title?: string | null;
  videoId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  sourceType?: string | null;
}

export type LibraryEntry = { kind: 'document'; data: Document } | { kind: 'video'; data: VideoListItem };

export interface PagedLibrary {
  items: LibraryEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type LibraryFilterType = 'all' | 'documents' | 'articles' | 'audio' | 'videos';

export interface GetLibraryParams {
  type?: LibraryFilterType;
  courseId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
}

const mapItem = (i: BackendLibraryItem): LibraryEntry => {
  if (i.kind === 'video') {
    return {
      kind: 'video',
      data: {
        id: i.id,
        courseId: i.courseId,
        courseName: i.courseName,
        courseColor: i.courseColor,
        videoId: i.videoId ?? '',
        videoUrl: i.videoUrl ?? '',
        sourceType: i.sourceType ?? 'youtube',
        title: i.title ?? '',
        thumbnailUrl: i.thumbnailUrl ?? '',
        createdAt: i.createdAt,
      },
    };
  }
  return {
    kind: 'document',
    data: {
      id: i.id,
      name: i.fileName ?? '',
      type: getDocumentType(i.contentType ?? '', i.fileName ?? ''),
      url: i.blobUrl ?? '',
      uploadDate: i.createdAt,
      courseId: i.courseId,
      courseName: i.courseName,
      courseColor: i.courseColor,
      summary: i.summary ?? undefined,
      originalUrl: i.originalUrl ?? undefined,
    },
  };
};

export const libraryService = {
  async getLibrary(params: GetLibraryParams = {}): Promise<PagedLibrary> {
    const p = new URLSearchParams({
      type: params.type ?? 'all',
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 8),
    });
    if (params.courseId) p.set('courseId', params.courseId);
    if (params.search) p.set('search', params.search);

    const response = await apiClient.get(`/api/library?${p}`);
    const data = response.data.data;
    return {
      items: (data.items as BackendLibraryItem[]).map(mapItem),
      totalCount: data.totalCount,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    };
  },
};
