import { apiClient } from './apiClient'
import { streamSse } from './streamSse'
import { Document, Note, ChatMessage, ChatThreadSummary, QuizQuestion, Flashcard } from '../types'
import { PendingMaterial } from './pendingMaterialService'
import type { ChatAttachment } from './aiService'

export interface QuizSubmission {
	submissionId: string
	documentId: string
	videoId?: string
	sourceType?: string
	documentName?: string
	videoName?: string
	answers: Record<string, string>
	score: number
	total: number
	submittedAt: string
}

export interface BackendDocument {
	documentId: string
	courseId: string
	userId: string
	fileName: string
	blobUrl: string
	contentType: string
	fileSize: number
	fileHash?: string
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
	attachments?: { url: string; mimeType: string; fileName?: string }[] | null
}

interface BackendQuiz {
	quizId: string
	question: string
	options: string[]
	correctAnswer: string
	explanation: string
	difficulty?: 'easy' | 'medium' | 'hard'
}

interface BackendFlashcard {
	flashcardId: string
	front: string
	back: string
	documentId?: string
	cardType?: string
	difficulty?: string
	chapter?: string
	tags?: string[]
}

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.m4b', '.wav', '.ogg', '.aac', '.flac', '.webm', '.opus', '.aiff', '.aif', '.wma', '.amr', '.mka']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.bmp', '.svg']
const PPT_EXTENSIONS = ['.ppt', '.pptx', '.pptm', '.potx']

// Formats the browser cannot render raw; the viewer shows the
// server-extracted plain text (GET .../documents/{id}/text) instead.
const SERVER_EXTRACTED_EXTENSIONS = [
	'.ppt', '.pptx', '.epub', '.mobi', '.fb2',
	'.doc', '.docm', '.dotx', '.rtf',
	'.xls', '.xlsx', '.xlsm', '.odt', '.odp', '.ods',
	'.pages', '.key', '.numbers',
	'.xps', '.oxps', '.vsdx',
	'.eml', '.mhtml', '.mht', '.msg',
	'.ipynb', '.html', '.htm', '.xhtml', '.smi',
]

export const usesServerExtractedText = (doc: { type: string; name: string }): boolean => {
	if (doc.type === 'ppt' || doc.type === 'epub') return true
	const name = doc.name.toLowerCase()
	return SERVER_EXTRACTED_EXTENSIONS.some(ext => name.endsWith(ext))
}

const getTypeFromContentTypeOrFileName = (
	contentType: string,
	fileName: string,
): 'pdf' | 'docx' | 'txt' | 'md' | 'audio' | 'podcast' | 'image' | 'ppt' | 'epub' => {
	const name = fileName.toLowerCase()
	if (contentType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
	if (
		contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
		name.endsWith('.docx')
	)
		return 'docx'
	if (
		contentType === 'text/markdown' ||
		contentType === 'text/x-markdown' ||
		name.endsWith('.md') ||
		name.endsWith('.markdown')
	)
		return 'md'
	if (
		contentType ===
			'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
		contentType === 'application/vnd.ms-powerpoint' ||
		PPT_EXTENSIONS.some(ext => name.endsWith(ext))
	)
		return 'ppt'
	if (contentType === 'application/epub+zip' || name.endsWith('.epub')) return 'epub'
	if (contentType.startsWith('image/') || IMAGE_EXTENSIONS.some(ext => name.endsWith(ext)))
		return 'image'
	if (contentType === 'audio/podcast') return 'podcast'
	if (contentType.startsWith('audio/') || AUDIO_EXTENSIONS.some(ext => name.endsWith(ext)))
		return 'audio'
	return 'txt'
}

export const mapDocument = (bd: BackendDocument): Document => ({
	id: bd.documentId,
	name: bd.fileName,
	title: bd.fileName,
	type: getTypeFromContentTypeOrFileName(bd.contentType, bd.fileName),
	url: bd.blobUrl,
	uploadDate: bd.createdAt,
	fileSize: bd.fileSize,
	fileHash: bd.fileHash,
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
	attachments: bm.attachments ?? undefined,
})

const mapQuiz = (bq: BackendQuiz): QuizQuestion => ({
	id: bq.quizId,
	question: bq.question,
	options: Array.isArray(bq.options) ? bq.options : [],
	answer: bq.correctAnswer,
	explanation: bq.explanation,
	type: 'multiple-choice',
	difficulty: bq.difficulty ?? 'medium',
})

const mapFlashcard = (bf: BackendFlashcard): Flashcard => ({
	id: bf.flashcardId,
	front: bf.front,
	back: bf.back,
	cardType: bf.cardType === 'cloze' ? 'cloze' : bf.cardType === 'chart' ? 'chart' : 'basic',
	difficulty: bf.difficulty === 'easy' || bf.difficulty === 'hard' ? bf.difficulty : 'medium',
	chapter: bf.chapter ?? undefined,
	tags: bf.tags ?? [],
	documentId: bf.documentId || '',
})

const mapQuizSubmission = (bs: any): QuizSubmission => ({
	submissionId: bs.submissionId,
	documentId: bs.documentId,
	videoId: bs.videoId ?? undefined,
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

const inflightDocumentListRequests = new Map<string, Promise<PagedDocuments>>()
const documentListCache = new Map<string, { value: PagedDocuments; expiresAt: number }>()
const DOCUMENT_LIST_CACHE_MS = 30_000

/**
 * Drop cached document-list responses. Called after any list mutation, and on
 * auth changes (so one user's list never leaks to the next).
 */
export const invalidateDocumentListCache = (): void => {
	documentListCache.clear()
	inflightDocumentListRequests.clear()
}

export const documentService = {
	async getAllDocuments(page = 1, pageSize = 3, courseId?: string): Promise<PagedDocuments> {
		const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
		if (courseId) params.set('courseId', courseId)
		const url = `/api/documents?${params}`

		// Serve a fresh cached response — collapses the duplicate fetches that the
		// deferred context load and a page's own self-fetch would otherwise make.
		const cached = documentListCache.get(url)
		if (cached && cached.expiresAt > Date.now()) return cached.value

		const pending = inflightDocumentListRequests.get(url)
		if (pending) return pending

		const request = apiClient
			.get(url)
			.then(response => {
				const data = response.data.data
				const result = {
					items: (data.items as BackendDocument[]).map(mapDocument),
					totalCount: data.totalCount,
					page: data.page,
					pageSize: data.pageSize,
					totalPages: data.totalPages,
				}
				documentListCache.set(url, {
					value: result,
					expiresAt: Date.now() + DOCUMENT_LIST_CACHE_MS,
				})
				return result
			})
			.finally(() => inflightDocumentListRequests.delete(url))

		inflightDocumentListRequests.set(url, request)
		return request
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
		invalidateDocumentListCache()
		return mapDocument(response.data.data)
	},

	async deleteDocument(courseId: string, documentId: string): Promise<void> {
		await apiClient.delete(`/api/courses/${courseId}/documents/${documentId}`)
		invalidateDocumentListCache()
	},

	async moveDocument(
		courseId: string,
		documentId: string,
		targetCourseId: string,
	): Promise<Document> {
		const response = await apiClient.patch(
			`/api/courses/${courseId}/documents/${documentId}/move`,
			{ targetCourseId },
		)
		invalidateDocumentListCache()
		return mapDocument(response.data.data)
	},

	async updateDocument(
		courseId: string,
		documentId: string,
		data: { fileName: string },
	): Promise<Document> {
		const response = await apiClient.patch(
			`/api/courses/${courseId}/documents/${documentId}`,
			data,
		)
		invalidateDocumentListCache()
		return mapDocument(response.data.data)
	},

	/** Persist a user-edited summary (markdown) back to the document. */
	async updateSummary(courseId: string, documentId: string, summary: string): Promise<Document> {
		const response = await apiClient.patch(
			`/api/courses/${courseId}/documents/${documentId}/content`,
			{ summary },
		)
		invalidateDocumentListCache()
		return mapDocument(response.data.data)
	},

	/** Persist a user-edited mind map (XMindMark/markdown source) back to the document. */
	async updateMindMap(
		courseId: string,
		documentId: string,
		mindMapText: string,
	): Promise<Document> {
		const response = await apiClient.patch(
			`/api/courses/${courseId}/documents/${documentId}/content`,
			{ mindMapText },
		)
		invalidateDocumentListCache()
		return mapDocument(response.data.data)
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

	async generateQuiz(
		courseId: string,
		documentId: string,
		difficulty = 'medium',
	): Promise<QuizQuestion[]> {
		const response = await apiClient.post(
			`/api/courses/${courseId}/documents/${documentId}/quiz/generate?difficulty=${encodeURIComponent(difficulty)}`,
		)
		return (response.data.data as BackendQuiz[]).map(mapQuiz)
	},

	async getQuiz(
		courseId: string,
		documentId: string,
		difficulty?: string,
	): Promise<QuizQuestion[]> {
		const query = difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : ''
		const response = await apiClient.get(
			`/api/courses/${courseId}/documents/${documentId}/quiz${query}`,
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
		attachments?: ChatAttachment[],
		conversationId?: string,
	): Promise<void> {
		const body: Record<string, unknown> = { message }
		if (attachments && attachments.length > 0) body.attachments = attachments
		if (conversationId) body.conversationId = conversationId
		return streamSse(`/api/courses/${courseId}/documents/${documentId}/chat/stream`, body, onChunk, signal)
	},

	async getChatHistory(courseId: string, documentId: string): Promise<ChatMessage[]> {
		const response = await apiClient.get(
			`/api/courses/${courseId}/documents/${documentId}/chat`,
		)
		return (response.data.data as BackendChatMessage[]).map(mapChatMessage)
	},

	async deleteChatHistory(courseId: string, documentId: string): Promise<void> {
		await apiClient.delete(`/api/courses/${courseId}/documents/${documentId}/chat`)
	},

	// ── Chat conversations (multiple threads per document) ─────────────────

	async listChatConversations(courseId: string, documentId: string): Promise<ChatThreadSummary[]> {
		const res = await apiClient.get<{ data: ChatThreadSummary[] }>(
			`/api/courses/${courseId}/documents/${documentId}/chat/conversations`,
		)
		return res.data?.data ?? []
	},

	async createChatConversation(courseId: string, documentId: string, title?: string): Promise<ChatThreadSummary> {
		const res = await apiClient.post<{ data: ChatThreadSummary }>(
			`/api/courses/${courseId}/documents/${documentId}/chat/conversations`,
			{ title: title ?? null },
		)
		return res.data.data
	},

	async getConversationMessages(courseId: string, documentId: string, conversationId: string): Promise<ChatMessage[]> {
		const response = await apiClient.get(
			`/api/courses/${courseId}/documents/${documentId}/chat/conversations/${conversationId}`,
		)
		return (response.data.data as BackendChatMessage[]).map(mapChatMessage)
	},

	async deleteChatConversation(courseId: string, documentId: string, conversationId: string): Promise<void> {
		await apiClient.delete(
			`/api/courses/${courseId}/documents/${documentId}/chat/conversations/${conversationId}`,
		)
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
	videoIds: string[]
}

const inflightQuizSubmissionListRequests = new Map<string, Promise<PagedQuizSubmissions>>()
const quizSubmissionListCache = new Map<
	string,
	{ value: PagedQuizSubmissions; expiresAt: number }
>()
const QUIZ_SUBMISSION_LIST_CACHE_MS = 2000
const inflightQuizMaterialRequests = new Map<string, Promise<unknown>>()

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
		const url = '/api/quiz-submissions/coverage'
		const pending = inflightQuizMaterialRequests.get(url) as
			| Promise<QuizSubmissionCoverage>
			| undefined
		if (pending) return pending

		const request = apiClient
			.get(url)
			.then(response => {
				const d = response.data.data
				return {
					documentIds: d.documentIds ?? [],
					videoIds: d.videoIds ?? [],
				}
			})
			.finally(() => inflightQuizMaterialRequests.delete(url))

		inflightQuizMaterialRequests.set(url, request)
		return request
	},

	async getPendingMaterials(): Promise<PendingMaterial[]> {
		const url = '/api/quiz-submissions/pending-materials'
		const pending = inflightQuizMaterialRequests.get(url) as
			| Promise<PendingMaterial[]>
			| undefined
		if (pending) return pending

		const request = apiClient
			.get(url)
			.then(response => response.data.data ?? [])
			.finally(() => inflightQuizMaterialRequests.delete(url))

		inflightQuizMaterialRequests.set(url, request)
		return request
	},

	async getGeneratedMaterials(): Promise<PendingMaterial[]> {
		const url = '/api/quiz-submissions/generated-materials'
		const pending = inflightQuizMaterialRequests.get(url) as
			| Promise<PendingMaterial[]>
			| undefined
		if (pending) return pending

		const request = apiClient
			.get(url)
			.then(response => response.data.data ?? [])
			.finally(() => inflightQuizMaterialRequests.delete(url))

		inflightQuizMaterialRequests.set(url, request)
		return request
	},

	clearListCache() {
		quizSubmissionListCache.clear()
	},
}
