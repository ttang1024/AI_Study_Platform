import { GlossaryTerm } from '../types'
import { apiClient } from './apiClient'
import { offlineCacheService } from './offlineCacheService'

export const glossaryService = {
	async getAllGlossary(): Promise<GlossaryTerm[]> {
		try {
			const res = await apiClient.get<{ data: any[] }>('/api/glossary')
			const terms = (res.data.data ?? []).map((t: any) => ({
				id: t.id,
				term: t.term,
				definition: t.definition,
				documentId: t.documentId,
				videoId: t.videoId,
				courseId: t.courseId,
				sourceName: t.sourceName,
				sourceKind: t.sourceKind,
			}))
			if (terms.length > 0) void offlineCacheService.cacheGlossary(terms)
			return terms
		} catch {
			// Offline or server error — serve the last cached glossary if we have one.
			return offlineCacheService.getCachedGlossary()
		}
	},

	async getGlossary(courseId: string, documentId: string): Promise<GlossaryTerm[]> {
		try {
			const res = await apiClient.get<{ data: any[] }>(
				`/api/courses/${courseId}/documents/${documentId}/glossary`,
			)
			return (res.data.data ?? []).map((t: any) => ({
				id: t.id,
				term: t.term,
				definition: t.definition,
				documentId: t.documentId,
			}))
		} catch {
			return []
		}
	},

	async generateGlossary(courseId: string, documentId: string): Promise<GlossaryTerm[]> {
		try {
			const res = await apiClient.post<{ data: any[] }>(
				`/api/courses/${courseId}/documents/${documentId}/glossary/generate`,
				{},
			)
			return (res.data.data ?? []).map((t: any) => ({
				id: t.id,
				term: t.term,
				definition: t.definition,
				documentId: t.documentId,
			}))
		} catch {
			return []
		}
	},

	async getVideoGlossary(videoId: string): Promise<GlossaryTerm[]> {
		try {
			const res = await apiClient.get<{ data: any[] }>(
				`/api/videos/${videoId}/glossary`,
			)
			return (res.data.data ?? []).map((t: any) => ({
				id: t.id,
				term: t.term,
				definition: t.definition,
				videoId: videoId,
			}))
		} catch {
			return []
		}
	},

	async generateVideoGlossary(videoId: string, videoUrl: string): Promise<GlossaryTerm[]> {
		const res = await apiClient.post<{ data: any[] }>(
			`/api/videos/${videoId}/glossary/generate`,
			{ videoUrl },
		)
		return (res.data.data ?? []).map((t: any) => ({
			id: t.id,
			term: t.term,
			definition: t.definition,
			videoId: videoId,
		}))
	},

	async updateTerm(termId: string, term: string, definition: string): Promise<GlossaryTerm> {
		const res = await apiClient.put<{ data: any }>(`/api/glossary/terms/${termId}`, {
			term,
			definition,
		})
		const t = res.data.data
		return {
			id: t.id,
			term: t.term,
			definition: t.definition,
			documentId: t.documentId,
			videoId: t.videoId,
		}
	},

	async deleteTerm(termId: string): Promise<void> {
		await apiClient.delete(`/api/glossary/terms/${termId}`)
	},
}
