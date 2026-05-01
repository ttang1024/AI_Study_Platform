import { apiClient } from './apiClient'
import { streamSse } from './streamSse'

// --- Types ---

export interface VideoListItem {
	id: string
	courseId: string
	courseName: string
	courseColor: string
	videoId: string
	videoUrl: string
	title: string
	thumbnailUrl: string
	summary: string | null
	noteContent: string | null
	flashcardsJson: string | null
	quizJson: string | null
	createdAt: string
}

export interface PagedVideos {
	items: VideoListItem[]
	totalCount: number
	page: number
	pageSize: number
	totalPages: number
}

export interface VideoDetail {
	id: string
	courseId: string
	videoId: string
	videoUrl: string
	title: string
	thumbnailUrl: string
	summary: string | null
	mindMapText: string | null
	flashcardsJson: string | null
	createdAt: string
}

export interface VideoFlashcard {
	flashcardId: string
	front: string
	back: string
}

export interface VideoQuizItem {
	quizId: string
	question: string
	options: string[]
	correctAnswer: string
	explanation: string
}

export interface TranscriptSegment {
	startSeconds: number
	text: string
}

export interface VideoNoteResult {
	noteId: string
	content: string
}

export interface PlaylistVideoItemData {
	videoId: string
	title: string
	thumbnailUrl: string
}

export interface CreateVideoData {
	courseId: string
	videoId: string
	videoUrl: string
	title: string
	thumbnailUrl: string
	summary: null
}

export interface GetVideosParams {
	page?: number
	pageSize?: number
	courseId?: string | null
	search?: string
}

// --- Service ---

const inflightVideoListRequests = new Map<string, Promise<PagedVideos>>()

export const youtubeService = {
	async getVideos(params: GetVideosParams = {}): Promise<PagedVideos> {
		const p = new URLSearchParams({
			page: String(params.page ?? 1),
			pageSize: String(params.pageSize ?? 8),
		})
		if (params.courseId) p.set('courseId', params.courseId)
		if (params.search) p.set('search', params.search)
		const url = `/api/youtube/videos?${p}`
		const pending = inflightVideoListRequests.get(url)
		if (pending) return pending

		const request = apiClient
			.get<{ data: PagedVideos }>(url)
			.then(res => res.data.data)
			.finally(() => inflightVideoListRequests.delete(url))

		inflightVideoListRequests.set(url, request)
		return request
	},

	async getVideo(id: string): Promise<VideoDetail> {
		const res = await apiClient.get<{ data: VideoDetail }>(`/api/youtube/videos/${id}`)
		return res.data.data
	},

	async createVideo(data: CreateVideoData): Promise<VideoDetail> {
		const res = await apiClient.post<{ data: VideoDetail }>('/api/youtube/videos', data)
		return res.data.data
	},

	async getPlaylistItems(playlistId: string): Promise<PlaylistVideoItemData[]> {
		const res = await apiClient.get<{ data: PlaylistVideoItemData[] }>(
			`/api/youtube/playlist-items?playlistId=${encodeURIComponent(playlistId)}`,
		)
		return res.data.data ?? []
	},

	async updateVideo(id: string, data: Record<string, unknown>): Promise<void> {
		await apiClient.patch(`/api/youtube/videos/${id}`, data)
	},

	async deleteVideo(id: string): Promise<void> {
		await apiClient.delete(`/api/youtube/videos/${id}`)
	},

	async moveVideo(id: string, targetCourseId: string): Promise<void> {
		await apiClient.patch(`/api/youtube/videos/${id}/move`, { targetCourseId })
	},

	async getFlashcards(videoId: string): Promise<VideoFlashcard[]> {
		const res = await apiClient.get<{ data: VideoFlashcard[] }>(
			`/api/youtube/videos/${videoId}/flashcards`,
		)
		return res.data.data ?? []
	},

	async generateFlashcards(videoId: string, videoUrl: string): Promise<VideoFlashcard[]> {
		const res = await apiClient.post<{ data: VideoFlashcard[] }>(
			`/api/youtube/videos/${videoId}/flashcards/generate`,
			{ videoUrl },
		)
		return res.data.data ?? []
	},

	async getQuiz(videoId: string): Promise<VideoQuizItem[]> {
		const res = await apiClient.get<{ data: VideoQuizItem[] }>(
			`/api/youtube/videos/${videoId}/quiz`,
		)
		return res.data.data ?? []
	},

	async generateQuiz(videoId: string, videoUrl: string): Promise<VideoQuizItem[]> {
		const res = await apiClient.post<{ data: VideoQuizItem[] }>(
			`/api/youtube/videos/${videoId}/quiz/generate`,
			{ videoUrl },
		)
		return res.data.data ?? []
	},

	async getTranscript(videoId: string): Promise<TranscriptSegment[]> {
		const res = await apiClient.get<{ data: TranscriptSegment[] }>(
			`/api/youtube/transcript?videoId=${encodeURIComponent(videoId)}`,
		)
		return res.data.data ?? []
	},

	async getSubtitles(videoId: string): Promise<TranscriptSegment[]> {
		const res = await apiClient.get<{ data: TranscriptSegment[] }>(
			`/api/youtube/subtitles?videoId=${encodeURIComponent(videoId)}`,
		)
		return res.data.data ?? []
	},

	async getVideoNote(videoRecordId: string): Promise<VideoNoteResult | null> {
		const res = await apiClient.get<{ data: { items: any[] } }>('/api/notes?pageSize=100')
		const items: any[] = res.data?.data?.items ?? []
		const note = items.find(
			n => n.youTubeVideoId === videoRecordId || n.youtubeVideoId === videoRecordId,
		)
		return note ? { noteId: note.noteId, content: note.content ?? '' } : null
	},

	async createNote(content: string, youTubeVideoId: string): Promise<VideoNoteResult> {
		const res = await apiClient.post<{ data: { noteId: string; content: string } }>(
			'/api/notes',
			{ content, youTubeVideoId },
		)
		return { noteId: res.data.data.noteId, content: res.data.data.content }
	},

	async updateNote(noteId: string, content: string): Promise<void> {
		await apiClient.put(`/api/notes/${noteId}`, { content })
	},

	async submitQuiz(
		videoId: string,
		answers: Record<string, string>,
		score: number,
		total: number,
	): Promise<void> {
		await apiClient.post(`/api/youtube/videos/${videoId}/quiz/submit`, {
			answers,
			score,
			total,
		})
	},

	async getVideoGlossary(
		videoId: string,
	): Promise<Array<{ id: string; term: string; definition: string }>> {
		try {
			const res = await apiClient.get<{ data: any[] }>(
				`/api/youtube/videos/${videoId}/glossary`,
			)
			return (res.data?.data ?? []).map((t: any) => ({
				id: t.id,
				term: t.term,
				definition: t.definition,
			}))
		} catch {
			return []
		}
	},

	async generateVideoGlossary(
		videoId: string,
		videoUrl: string,
	): Promise<Array<{ id: string; term: string; definition: string }>> {
		const res = await apiClient.post<{ data: any[] }>(
			`/api/youtube/videos/${videoId}/glossary/generate`,
			{ videoUrl },
		)
		return (res.data?.data ?? []).map((t: any) => ({
			id: t.id,
			term: t.term,
			definition: t.definition,
		}))
	},

	async getQuizSubmission(
		videoId: string,
	): Promise<{ answers: Record<string, string>; score: number; total: number } | null> {
		const res = await apiClient.get<{ data: any }>(
			`/api/youtube/videos/${videoId}/quiz/submission`,
		)
		const data = res.data?.data
		if (!data) return null
		return { answers: data.answers ?? {}, score: data.score, total: data.total }
	},

	async getChatHistory(
		videoId: string,
	): Promise<Array<{ id: string; role: 'user' | 'model'; content: string }>> {
		const res = await apiClient.get<{ data: any[] }>(`/api/youtube/videos/${videoId}/chat`)
		return (res.data?.data ?? []).map((m: any) => ({
			id: m.messageId,
			role: m.role === 'assistant' ? 'model' : (m.role as 'user' | 'model'),
			content: m.content,
		}))
	},

	async sendChat(
		videoId: string,
		message: string,
	): Promise<{ id: string; role: 'user' | 'model'; content: string }> {
		const res = await apiClient.post<{ data: any }>(`/api/youtube/videos/${videoId}/chat`, {
			message,
		})
		const m = res.data.data
		return { id: m.messageId, role: 'model', content: m.content }
	},

	async streamSummary(
		videoUrl: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse('/api/youtube/summary/stream', { videoUrl }, onChunk, signal)
	},

	async streamChat(
		videoId: string,
		message: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse(`/api/youtube/videos/${videoId}/chat/stream`, { message }, onChunk, signal)
	},
}
