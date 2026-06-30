import { apiClient } from './apiClient'
import { Document } from '../types'
import { mapDocument, BackendDocument } from './documentService'
import { VideoListItem } from './videoService'

// Unified library row from GET /api/library — either a document or a video.
interface BackendLibraryItem {
	kind: 'document' | 'video'
	id: string
	courseId: string
	courseName: string
	courseColor: string
	createdAt: string
	// document fields
	fileName?: string | null
	blobUrl?: string | null
	contentType?: string | null
	fileSize?: number | null
	fileHash?: string | null
	originalUrl?: string | null
	summary?: string | null
	// video fields
	title?: string | null
	videoId?: string | null
	videoUrl?: string | null
	thumbnailUrl?: string | null
	sourceType?: 'youtube' | 'bilibili' | 'upload' | null
}

// Normalized shape the Library page renders — mirrors its existing LibraryItem union.
export type LibraryEntry =
	| { kind: 'document'; data: Document }
	| { kind: 'video'; data: VideoListItem }

export interface PagedLibrary {
	items: LibraryEntry[]
	totalCount: number
	page: number
	pageSize: number
	totalPages: number
}

export type LibraryFilterType = 'all' | 'documents' | 'articles' | 'audio' | 'videos'

export interface GetLibraryParams {
	type?: LibraryFilterType
	courseId?: string | null
	search?: string
	page?: number
	pageSize?: number
}

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
	sourceType: i.sourceType ?? 'youtube',
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

export const libraryService = {
	// One page of the merged documents+videos list, filtered/sorted/paginated server-side.
	async getLibrary(params: GetLibraryParams = {}): Promise<PagedLibrary> {
		const p = new URLSearchParams({
			type: params.type ?? 'all',
			page: String(params.page ?? 1),
			pageSize: String(params.pageSize ?? 8),
		})
		if (params.courseId) p.set('courseId', params.courseId)
		if (params.search) p.set('search', params.search)

		const response = await apiClient.get(`/api/library?${p}`)
		const data = response.data.data
		return {
			items: (data.items as BackendLibraryItem[]).map(mapItem),
			totalCount: data.totalCount,
			page: data.page,
			pageSize: data.pageSize,
			totalPages: data.totalPages,
		}
	},
}
