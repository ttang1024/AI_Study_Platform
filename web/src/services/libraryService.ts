// Endpoint + paging logic moved to the shared package (packages/core). The
// row mappers stay here because web's Document/VideoListItem DTOs haven't been
// reconciled with rn's — each app injects its own `mapItem`.
import {
	createLibraryService,
	type BackendLibraryItem,
	type PagedLibraryOf,
} from '@core/services/libraryService'
import { Document } from '../types'
import { mapDocument, BackendDocument } from './documentService'
import { VideoListItem } from './videoService'
import type { VideoSourceType } from '../constants/videoSources'

export type { BackendLibraryItem, GetLibraryParams, LibraryFilterType } from '@core/services/libraryService'
import { http } from './http'

// Normalized shape the Library page renders — mirrors its existing LibraryItem union.
export type LibraryEntry =
	| { kind: 'document'; data: Document }
	| { kind: 'video'; data: VideoListItem }

export type PagedLibrary = PagedLibraryOf<LibraryEntry>

const toDocument = (i: BackendLibraryItem): Document =>
	mapDocument({
		documentId: i.id,
		courseId: i.courseId,
		userId: '',
		fileName: i.fileName ?? '',
		blobUrl: i.blobUrl ?? '',
		contentType: i.contentType ?? '',
		fileSize: i.fileSize ?? 0,
		fileHash: i.fileHash ?? undefined,
		originalUrl: i.originalUrl ?? undefined,
		summary: i.summary ?? undefined,
		createdAt: i.createdAt,
		updatedAt: i.createdAt,
	} as BackendDocument)

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
})

const mapItem = (i: BackendLibraryItem): LibraryEntry =>
	i.kind === 'video'
		? { kind: 'video', data: toVideo(i) }
		: { kind: 'document', data: toDocument(i) }

export const libraryService = createLibraryService(http, mapItem)
