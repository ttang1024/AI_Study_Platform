import { apiClient } from './apiClient'
import { streamSse } from './streamSse'
import { getApiUrl } from '../utils/env'

// --- Types ---

export interface VideoListItem {
	id: string
	courseId: string
	courseName: string
	courseColor: string
	videoId: string
	videoUrl: string
	sourceType?: 'youtube' | 'bilibili' | 'upload'
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
	sourceType?: 'youtube' | 'bilibili' | 'upload'
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
	cardType?: 'basic' | 'cloze' | 'chart'
	difficulty?: 'easy' | 'medium' | 'hard'
	chapter?: string
	tags?: string[]
}

export interface VideoQuizItem {
	quizId: string
	question: string
	options: string[]
	correctAnswer: string
	explanation: string
	difficulty?: 'easy' | 'medium' | 'hard'
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
	sourceType?: 'youtube' | 'bilibili' | 'upload'
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
const VIDEO_API = '/api/videos'

export const videoService = {
	async getVideos(params: GetVideosParams = {}): Promise<PagedVideos> {
		const p = new URLSearchParams({
			page: String(params.page ?? 1),
			pageSize: String(params.pageSize ?? 8),
		})
		if (params.courseId) p.set('courseId', params.courseId)
		if (params.search) p.set('search', params.search)
		const url = `${VIDEO_API}?${p}`
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
		const res = await apiClient.get<{ data: VideoDetail }>(`${VIDEO_API}/${id}`)
		return res.data.data
	},

	async createVideo(data: CreateVideoData): Promise<VideoDetail> {
		const res = await apiClient.post<{ data: VideoDetail }>(VIDEO_API, data)
		return res.data.data
	},

	async uploadVideo(courseId: string, file: File, thumbnail?: Blob): Promise<VideoDetail> {
		const formData = new FormData()
		formData.append('courseId', courseId)
		formData.append('file', file)
		if (thumbnail) {
			formData.append('thumbnail', thumbnail, `${file.name.replace(/\.[^.]+$/, '') || 'video'}-cover.jpg`)
		}
		const res = await apiClient.post<{ data: VideoDetail }>(
			`${VIDEO_API}/upload`,
			formData,
			{ headers: { 'Content-Type': 'multipart/form-data' } },
		)
		return res.data.data
	},

	async getPlaybackUrl(videoRecordId: string): Promise<string> {
		const res = await apiClient.get<{ data: string }>(`${VIDEO_API}/${videoRecordId}/playback-url`)
		return res.data.data
	},

	getUploadedVideoStreamUrl(videoRecordId: string): string {
		const token = typeof window !== 'undefined' ? localStorage.getItem('sp_access_token') : null
		const baseUrl = getApiUrl()
		const path = `${VIDEO_API}/${videoRecordId}/file`
		return token
			? `${baseUrl}${path}?access_token=${encodeURIComponent(token)}`
			: `${baseUrl}${path}`
	},

	getUploadedVideoThumbnailUrl(videoRecordId: string): string {
		const token = typeof window !== 'undefined' ? localStorage.getItem('sp_access_token') : null
		const baseUrl = getApiUrl()
		const path = `${VIDEO_API}/${videoRecordId}/thumbnail`
		return token
			? `${baseUrl}${path}?access_token=${encodeURIComponent(token)}`
			: `${baseUrl}${path}`
	},

	async getVideoMetadata(videoUrl: string): Promise<{ title: string; thumbnailUrl: string } | null> {
		try {
			const res = await apiClient.get<{ data: { title: string; thumbnailUrl: string } }>(
				`${VIDEO_API}/video-metadata?videoUrl=${encodeURIComponent(videoUrl)}`,
			)
			return res.data.data ?? null
		} catch {
			return null
		}
	},

	async getPlaylistItems(playlistId: string): Promise<PlaylistVideoItemData[]> {
		const res = await apiClient.get<{ data: PlaylistVideoItemData[] }>(
			`${VIDEO_API}/playlist-items?playlistId=${encodeURIComponent(playlistId)}`,
		)
		return res.data.data ?? []
	},

	async updateVideo(id: string, data: Record<string, unknown>): Promise<VideoListItem> {
		const res = await apiClient.patch<{ data: VideoListItem }>(`${VIDEO_API}/${id}`, data)
		return res.data.data
	},

	async deleteVideo(id: string): Promise<void> {
		await apiClient.delete(`${VIDEO_API}/${id}`)
	},

	async moveVideo(id: string, targetCourseId: string): Promise<void> {
		await apiClient.patch(`${VIDEO_API}/${id}/move`, { targetCourseId })
	},

	async getFlashcards(videoId: string): Promise<VideoFlashcard[]> {
		const res = await apiClient.get<{ data: VideoFlashcard[] }>(
			`${VIDEO_API}/${videoId}/flashcards`,
		)
		return res.data.data ?? []
	},

	async generateFlashcards(videoId: string, videoUrl: string): Promise<VideoFlashcard[]> {
		const res = await apiClient.post<{ data: VideoFlashcard[] }>(
			`${VIDEO_API}/${videoId}/flashcards/generate`,
			{ videoUrl },
		)
		return res.data.data ?? []
	},

	async getQuiz(videoId: string, difficulty?: string): Promise<VideoQuizItem[]> {
		const query = difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : ''
		const res = await apiClient.get<{ data: VideoQuizItem[] }>(
			`${VIDEO_API}/${videoId}/quiz${query}`,
		)
		return res.data.data ?? []
	},

	async generateQuiz(videoId: string, videoUrl: string, difficulty = 'medium'): Promise<VideoQuizItem[]> {
		const res = await apiClient.post<{ data: VideoQuizItem[] }>(
			`${VIDEO_API}/${videoId}/quiz/generate?difficulty=${encodeURIComponent(difficulty)}`,
			{ videoUrl },
		)
		return res.data.data ?? []
	},

	async getTranscript(videoId: string): Promise<TranscriptSegment[]> {
		const res = await apiClient.get<{ data: TranscriptSegment[] }>(
			`${VIDEO_API}/transcript?videoId=${encodeURIComponent(videoId)}`,
		)
		return res.data.data ?? []
	},

	async getVideoTranscript(videoRecordId: string): Promise<TranscriptSegment[]> {
		const res = await apiClient.get<{ data: TranscriptSegment[] }>(
			`${VIDEO_API}/${videoRecordId}/transcript`,
		)
		return res.data.data ?? []
	},

	async getSubtitles(videoId: string): Promise<TranscriptSegment[]> {
		const res = await apiClient.get<{ data: TranscriptSegment[] }>(
			`${VIDEO_API}/subtitles?videoId=${encodeURIComponent(videoId)}`,
		)
		return res.data.data ?? []
	},

	async getVideoSubtitles(videoRecordId: string): Promise<TranscriptSegment[]> {
		const res = await apiClient.get<{ data: TranscriptSegment[] }>(
			`${VIDEO_API}/${videoRecordId}/subtitles`,
		)
		return res.data.data ?? []
	},

	async getVideoNote(videoRecordId: string): Promise<VideoNoteResult | null> {
		const notes = await this.getVideoNotes(videoRecordId)
		const note = notes[0]
		return note ? { noteId: note.noteId, content: note.content ?? '' } : null
	},

	async getVideoNotes(videoRecordId: string): Promise<Array<{ noteId: string; youTubeVideoId?: string; content: string; createdAt: string; updatedAt?: string }>> {
		const res = await apiClient.get<{ data: any[] }>(`${VIDEO_API}/${videoRecordId}/notes`)
		return res.data?.data ?? []
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
		await apiClient.post(`${VIDEO_API}/${videoId}/quiz/submit`, {
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
				`${VIDEO_API}/${videoId}/glossary`,
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
			`${VIDEO_API}/${videoId}/glossary/generate`,
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
			`${VIDEO_API}/${videoId}/quiz/submission`,
		)
		const data = res.data?.data
		if (!data) return null
		return { answers: data.answers ?? {}, score: data.score, total: data.total }
	},

	async getChatHistory(
		videoId: string,
	): Promise<Array<{ id: string; role: 'user' | 'model'; content: string }>> {
		const res = await apiClient.get<{ data: any[] }>(`${VIDEO_API}/${videoId}/chat`)
		return (res.data?.data ?? []).map((m: any) => ({
			id: m.messageId,
			role: m.role === 'assistant' ? 'model' : (m.role as 'user' | 'model'),
			content: m.content,
		}))
	},

	async deleteChatHistory(videoId: string): Promise<void> {
		await apiClient.delete(`${VIDEO_API}/${videoId}/chat`)
	},

	async sendChat(
		videoId: string,
		message: string,
	): Promise<{ id: string; role: 'user' | 'model'; content: string }> {
		const res = await apiClient.post<{ data: any }>(`${VIDEO_API}/${videoId}/chat`, {
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
		return streamSse(`${VIDEO_API}/summary/stream`, { videoUrl }, onChunk, signal)
	},

	async streamVideoSummary(
		videoRecordId: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse(`${VIDEO_API}/${videoRecordId}/summary/stream`, {}, onChunk, signal)
	},

	async streamVideoMindMap(
		videoRecordId: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse(`${VIDEO_API}/${videoRecordId}/mindmap/stream`, {}, onChunk, signal)
	},

	async streamChat(
		videoId: string,
		message: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse(`${VIDEO_API}/${videoId}/chat/stream`, { message }, onChunk, signal)
	},
}
