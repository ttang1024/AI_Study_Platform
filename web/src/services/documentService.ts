import { apiClient } from './apiClient'
import { streamSse } from './streamSse'
import { Document, Note, ChatMessage, QuizQuestion, Flashcard } from '../types'
import { PendingMaterial } from './pendingMaterialService'

export interface QuizSubmission {
	submissionId: string
	documentId: string
	youTubeVideoId?: string
	sourceType?: string
	documentName?: string
	videoName?: string
	answers: Record<string, string>
	score: number
	total: number
	submittedAt: string
}

interface BackendDocument {
	documentId: string
	courseId: string
	userId: string
	fileName: string
	blobUrl: string
	contentType: string
	fileSize: number
	summary?: string
	mindMapText?: string
	transcript?: string
	originalUrl?: string
	createdAt: string
	updatedAt: string
}

interface BackendNote {
	noteId: string
	documentId: string
	content: string
	createdAt: string
}

interface BackendChatMessage {
	messageId: string
	role: 'user' | 'model' | 'assistant'
	content: string
	createdAt: string
}

interface BackendQuiz {
	quizId: string
	question: string
	options: string[]
	correctAnswer: string
	explanation: string
}

interface BackendFlashcard {
	flashcardId: string
	front: string
	back: string
	documentId?: string
}

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac', '.webm']

const getTypeFromContentTypeOrFileName = (
	contentType: string,
	fileName: string,
): 'pdf' | 'docx' | 'txt' | 'md' | 'audio' | 'podcast' => {
	if (contentType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return 'pdf'
	if (
		contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
		fileName.toLowerCase().endsWith('.docx')
	)
		return 'docx'
	if (
		contentType === 'text/markdown' ||
		contentType === 'text/x-markdown' ||
		fileName.toLowerCase().endsWith('.md') ||
		fileName.toLowerCase().endsWith('.markdown')
	)
		return 'md'
	if (contentType === 'audio/podcast') return 'podcast'
	if (
		contentType.startsWith('audio/') ||
		AUDIO_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext))
	)
		return 'audio'
	return 'txt'
}

const mapDocument = (bd: BackendDocument): Document => ({
	id: bd.documentId,
	name: bd.fileName,
	title: bd.fileName,
	type: getTypeFromContentTypeOrFileName(bd.contentType, bd.fileName),
	url: bd.blobUrl,
	uploadDate: bd.createdAt,
	courseId: bd.courseId || undefined,
	summary: bd.summary,
	mindMapText: bd.mindMapText,
	transcript: bd.transcript,
	originalUrl: bd.originalUrl,
})

const mapNote = (bn: BackendNote): Note => ({
	id: bn.noteId,
	documentId: bn.documentId,
	content: bn.content,
	createdAt: bn.createdAt,
})

const mapChatMessage = (bm: BackendChatMessage): ChatMessage => ({
	id: bm.messageId,
	role: bm.role === 'assistant' ? 'model' : bm.role,
	content: bm.content,
	timestamp: bm.createdAt,
})

const mapQuiz = (bq: BackendQuiz): QuizQuestion => ({
	id: bq.quizId,
	question: bq.question,
	options: Array.isArray(bq.options) ? bq.options : [],
	answer: bq.correctAnswer,
	explanation: bq.explanation,
	type: 'multiple-choice',
})

const mapFlashcard = (bf: BackendFlashcard): Flashcard => ({
	id: bf.flashcardId,
	front: bf.front,
	back: bf.back,
	documentId: bf.documentId || '',
	difficulty: 'medium',
})

const mapQuizSubmission = (bs: any): QuizSubmission => ({
	submissionId: bs.submissionId,
	documentId: bs.documentId,
	youTubeVideoId: bs.youTubeVideoId ?? undefined,
	sourceType: bs.sourceType ?? undefined,
	documentName: bs.document ?? (bs.sourceType === 'document' ? bs.title : undefined) ?? undefined,
	videoName: bs.video ?? (bs.sourceType === 'video' ? bs.title : undefined) ?? undefined,
	answers: bs.answers ?? {},
	score: bs.score,
	total: bs.total,
	submittedAt: bs.submittedAt,
})

export interface PagedDocuments {
	items: Document[]
	totalCount: number
	page: number
	pageSize: number
	totalPages: number
}

export const documentService = {
	async getAllDocuments(page = 1, pageSize = 3, courseId?: string): Promise<PagedDocuments> {
		const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
		if (courseId) params.set('courseId', courseId)
		const response = await apiClient.get(`/api/documents?${params}`)
		const data = response.data.data
		return {
			items: (data.items as BackendDocument[]).map(mapDocument),
			totalCount: data.totalCount,
			page: data.page,
			pageSize: data.pageSize,
			totalPages: data.totalPages,
		}
	},

	async getDocuments(courseId: string): Promise<Document[]> {
		const response = await apiClient.get(`/api/courses/${courseId}/documents`)
		return (response.data.data as BackendDocument[]).map(mapDocument)
	},

	async getDocument(courseId: string, documentId: string): Promise<Document> {
		const response = await apiClient.get(`/api/courses/${courseId}/documents/${documentId}`)
		return mapDocument(response.data.data)
	},

	async uploadDocument(courseId: string, file: File): Promise<Document> {
		const formData = new FormData()
		formData.append('file', file)
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/upload?courseId=${courseId}`,
			formData,
			{ headers: { 'Content-Type': 'multipart/form-data' } },
		)
		return mapDocument(response.data.data)
	},

	async deleteDocument(courseId: string, documentId: string): Promise<void> {
		await apiClient.delete(`/api/courses/${courseId}/documents/${documentId}`)
	},

	async moveDocument(courseId: string, documentId: string, targetCourseId: string): Promise<Document> {
		const response = await apiClient.patch(
			`/api/courses/${courseId}/documents/${documentId}/move`,
			{ targetCourseId },
		)
		return mapDocument(response.data.data)
	},

	async getDownloadUrl(courseId: string, documentId: string): Promise<string> {
		const response = await apiClient.get(
			`/api/courses/${courseId}/documents/${documentId}/download-url`,
		)
		return response.data.data
	},

	async generateSummary(
		courseId: string,
		documentId: string,
	): Promise<{ summary: string; keyPoints: string[] }> {
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/${documentId}/summary`,
		)
		const doc = response.data.data as BackendDocument
		try {
			return JSON.parse(doc.summary || '{}')
		} catch {
			return { summary: doc.summary || '', keyPoints: [] }
		}
	},

	async generateMindMap(courseId: string, documentId: string): Promise<{ mindMapText: string }> {
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/${documentId}/mindmap`,
		)
		const doc = response.data.data as BackendDocument
		return { mindMapText: doc.mindMapText || '' }
	},

	async generateQuiz(courseId: string, documentId: string): Promise<QuizQuestion[]> {
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/${documentId}/quiz/generate`,
		)
		return (response.data.data as BackendQuiz[]).map(mapQuiz)
	},

	async getQuiz(courseId: string, documentId: string): Promise<QuizQuestion[]> {
		const response = await apiClient.get(
			`/api/courses/${courseId}/documents/${documentId}/quiz`,
		)
		return (response.data.data as BackendQuiz[]).map(mapQuiz)
	},

	async generateFlashcards(courseId: string, documentId: string): Promise<Flashcard[]> {
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/${documentId}/flashcards/generate`,
		)
		return (response.data.data as BackendFlashcard[]).map(bf => ({
			...mapFlashcard(bf),
			documentId,
		}))
	},

	async getFlashcards(courseId: string, documentId: string): Promise<Flashcard[]> {
		const response = await apiClient.get(
			`/api/courses/${courseId}/documents/${documentId}/flashcards`,
		)
		return (response.data.data as BackendFlashcard[]).map(bf => ({
			...mapFlashcard(bf),
			documentId,
		}))
	},

	async chat(courseId: string, documentId: string, message: string): Promise<string> {
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/${documentId}/chat`,
			{ message },
		)
		return response.data.data.content
	},

	async streamSummary(
		courseId: string,
		documentId: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse(
			`/api/courses/${courseId}/documents/${documentId}/summary/stream`,
			{},
			onChunk,
			signal,
		)
	},

	async streamMindMap(
		courseId: string,
		documentId: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse(
			`/api/courses/${courseId}/documents/${documentId}/mindmap/stream`,
			{},
			onChunk,
			signal,
		)
	},

	async streamChat(
		courseId: string,
		documentId: string,
		message: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse(
			`/api/courses/${courseId}/documents/${documentId}/chat/stream`,
			{ message },
			onChunk,
			signal,
		)
	},

	async getChatHistory(courseId: string, documentId: string): Promise<ChatMessage[]> {
		const response = await apiClient.get(
			`/api/courses/${courseId}/documents/${documentId}/chat`,
		)
		return (response.data.data as BackendChatMessage[]).map(mapChatMessage)
	},

	async getNotes(courseId: string, documentId: string): Promise<Note[]> {
		const response = await apiClient.get(
			`/api/courses/${courseId}/documents/${documentId}/notes`,
		)
		return (response.data.data as BackendNote[]).map(mapNote)
	},

	async createNote(courseId: string, documentId: string, content: string): Promise<Note> {
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/${documentId}/notes`,
			{ content },
		)
		return mapNote(response.data.data)
	},

	async updateNote(
		courseId: string,
		documentId: string,
		noteId: string,
		content: string,
	): Promise<Note> {
		const response = await apiClient.put(
			`/api/courses/${courseId}/documents/${documentId}/notes/${noteId}`,
			{ content },
		)
		return mapNote(response.data.data)
	},

	async deleteNote(courseId: string, documentId: string, noteId: string): Promise<void> {
		await apiClient.delete(`/api/courses/${courseId}/documents/${documentId}/notes/${noteId}`)
	},

	async saveQuizSubmission(
		courseId: string,
		documentId: string,
		answers: Record<string, string>,
		score: number,
		total: number,
	): Promise<QuizSubmission> {
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/${documentId}/quiz/submission`,
			{ answers, score, total },
		)
		return mapQuizSubmission(response.data.data)
	},

	async getQuizSubmission(courseId: string, documentId: string): Promise<QuizSubmission | null> {
		const response = await apiClient.get(
			`/api/courses/${courseId}/documents/${documentId}/quiz/submission`,
		)
		if (!response.data.data) return null
		return mapQuizSubmission(response.data.data)
	},
}

export interface PagedQuizSubmissions {
	items: QuizSubmission[]
	totalCount: number
	page: number
	pageSize: number
	totalPages: number
}

export interface QuizSubmissionCoverage {
	documentIds: string[]
	youTubeVideoIds: string[]
}

const inflightQuizSubmissionListRequests = new Map<string, Promise<PagedQuizSubmissions>>()
const quizSubmissionListCache = new Map<string, { value: PagedQuizSubmissions; expiresAt: number }>()
const QUIZ_SUBMISSION_LIST_CACHE_MS = 2000

export const quizSubmissionService = {
	async getAllSubmissions(page = 1, pageSize = 20): Promise<PagedQuizSubmissions> {
		const url = `/api/quiz-submissions?page=${page}&pageSize=${pageSize}`
		const cached = quizSubmissionListCache.get(url)
		if (cached && cached.expiresAt > Date.now()) return cached.value

		const pending = inflightQuizSubmissionListRequests.get(url)
		if (pending) return pending

		const request = apiClient
			.get(url)
			.then(response => {
				const d = response.data.data
				const value = {
					items: (d.items as any[]).map(mapQuizSubmission),
					totalCount: d.totalCount,
					page: d.page,
					pageSize: d.pageSize,
					totalPages: d.totalPages,
				}
				quizSubmissionListCache.set(url, {
					value,
					expiresAt: Date.now() + QUIZ_SUBMISSION_LIST_CACHE_MS,
				})
				return value
			})
			.finally(() => inflightQuizSubmissionListRequests.delete(url))

		inflightQuizSubmissionListRequests.set(url, request)
		return request
	},

	async getCoverage(): Promise<QuizSubmissionCoverage> {
		const response = await apiClient.get('/api/quiz-submissions/coverage')
		const d = response.data.data
		return {
			documentIds: d.documentIds ?? [],
			youTubeVideoIds: d.youTubeVideoIds ?? [],
		}
	},

	async getPendingMaterials(): Promise<PendingMaterial[]> {
		const response = await apiClient.get('/api/quiz-submissions/pending-materials')
		return response.data.data ?? []
	},
}
