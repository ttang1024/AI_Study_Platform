// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP + SSE adapters into the shared factories and re-exports the types, so
// existing `@/services/documentService` imports across web/ keep working
// unchanged. Only uploadDocument stays web-local: it uploads a browser `File`.
import {
	createDocumentService,
	createQuizSubmissionService,
	mapDocument,
	type BackendDocument,
} from '@core/services/documentService'
import { http } from './http'
import { streamSse } from './streamSse'
import { apiClient } from './apiClient'
import { Document } from '../types'

export * from '@core/services/documentService'

const coreService = createDocumentService(http, streamSse)

/** Standalone export kept for existing call sites (StudyContext auth reset, mutations). */
export const invalidateDocumentListCache = (): void => coreService.invalidateDocumentListCache()

export const documentService = {
	...coreService,

	async uploadDocument(courseId: string, file: File): Promise<Document> {
		const formData = new FormData()
		formData.append('file', file)
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/upload?courseId=${courseId}`,
			formData,
			{ headers: { 'Content-Type': 'multipart/form-data' } },
		)
		coreService.invalidateDocumentListCache()
		return mapDocument(response.data.data as BackendDocument)
	},
}

export const quizSubmissionService = createQuizSubmissionService(http)
