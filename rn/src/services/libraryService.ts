// Endpoint + paging logic moved to the shared package (packages/core). The row
// mappers stay here because rn's Document/VideoListItem DTOs haven't been
// reconciled with web's — each app injects its own `mapItem`.
import {
  createLibraryService,
  type BackendLibraryItem,
  type PagedLibraryOf,
} from '@core/services/libraryService';
import { http } from '@/services/http';
import type { Document, VideoListItem } from '@/types';

export type { GetLibraryParams, LibraryFilterType } from '@core/services/libraryService';

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

export type LibraryEntry = { kind: 'document'; data: Document } | { kind: 'video'; data: VideoListItem };

export type PagedLibrary = PagedLibraryOf<LibraryEntry>;

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

export const libraryService = createLibraryService(http, mapItem);
