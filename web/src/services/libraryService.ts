// Endpoint, paging, and the row mapper all live in the shared package
// (packages/core) — Document/VideoListItem are shared DTOs now, so the mapper
// is no longer per-app. Re-exported so existing imports keep working unchanged.
import { createLibraryService, mapLibraryItem } from '@core/services/libraryService'
import { http } from './http'

export type {
	BackendLibraryItem,
	GetLibraryParams,
	LibraryEntry,
	LibraryFilterType,
	PagedLibrary,
} from '@core/services/libraryService'

export const libraryService = createLibraryService(http, mapLibraryItem)
