import { GlossaryTerm } from '../types'
import { apiClient } from './apiClient'

export const glossaryService = {
	async getAllGlossary(): Promise<GlossaryTerm[]> {
		try {
			const res = await apiClient.get<{ data: any[] }>('/api/glossary')
			return (res.data.data ?? []).map((t: any) => ({
				id: t.id,
				term: t.term,
				definition: t.definition,
				documentId: t.documentId,
				youTubeVideoId: t.youTubeVideoId,
				courseId: t.courseId,
				sourceName: t.sourceName,
				sourceKind: t.sourceKind,
			}))
		} catch {
			return []
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
				youTubeVideoId: videoId,
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
			youTubeVideoId: videoId,
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
			youTubeVideoId: t.youTubeVideoId,
		}
	},

	async deleteTerm(termId: string): Promise<void> {
		await apiClient.delete(`/api/glossary/terms/${termId}`)
	},
}
