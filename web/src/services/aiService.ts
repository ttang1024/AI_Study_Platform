import { apiClient } from './apiClient'
import { streamSse } from './streamSse'

type ChatHistoryEntry = { role: 'user' | 'model'; parts: { text: string }[] }

function toHistoryEntries(history: ChatHistoryEntry[]) {
	return history.map(h => ({
		role: h.role,
		content: h.parts.map(p => p.text).join(' '),
	}))
}

function parseApiError(err: any): never {
	const msg: string = err?.response?.data?.message ?? err?.message ?? ''
	if (
		err?.response?.status === 429 ||
		msg.includes('TooManyRequests') ||
		msg.includes('RESOURCE_EXHAUSTED') ||
		msg.includes('quota')
	) {
		const retryMatch = msg.match(/retry in ([\d.]+)s/i)
		const seconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null
		const hint = seconds ? ` Please try again in ~${seconds}s.` : ' Please try again later.'
		throw new Error(`AI quota exceeded.${hint}`)
	}
	throw err
}

async function post<T>(url: string, body: unknown): Promise<T> {
	try {
		const res = await apiClient.post<{ data: T }>(url, body)
		return res.data.data
	} catch (err) {
		parseApiError(err)
	}
}

/** An image/PDF attachment uploaded with a chat turn. `data` is raw base64 (no data: URL prefix). */
export interface ChatAttachment {
	mimeType: string;
	data: string;
	fileName?: string;
}

/** An attachment as displayed on a message. `url` is a presigned URL (history) or data: URL (optimistic). */
export interface ChatMessageAttachment {
	url: string;
	mimeType: string;
	fileName?: string;
}

/** Builds inline data: URLs from staged attachments so an optimistic user message can show thumbnails immediately. */
export function attachmentsToDisplay(attachments?: ChatAttachment[]): ChatMessageAttachment[] | undefined {
	if (!attachments || attachments.length === 0) return undefined
	return attachments.map(a => ({
		url: `data:${a.mimeType};base64,${a.data}`,
		mimeType: a.mimeType,
		fileName: a.fileName,
	}))
}

export interface ChatSessionSummary {
	sourceType: 'document' | 'video' | 'general';
	sourceId: string;
	sourceName: string;
	courseId: string | null;
	/** The thread this summary describes; for general chats this equals sourceId. */
	conversationId: string;
	conversationTitle: string;
	lastMessage: string;
	lastMessageRole: string;
	updatedAt: string;
	messageCount: number;
}

export interface GeneralChatConversation {
	conversationId: string;
	title: string;
	createdAt: string;
	updatedAt: string;
}

export interface ChatMessageDto {
	messageId: string;
	documentId?: string | null;
	youTubeVideoId?: string | null;
	sourceType: string;
	role: 'user' | 'assistant' | 'model';
	content: string;
	createdAt: string;
	attachments?: ChatMessageAttachment[] | null;
}

export const aiService = {
	async getChatSessions(): Promise<ChatSessionSummary[]> {
		try {
			const res = await apiClient.get<{ data: ChatSessionSummary[] }>('/api/ai/chat/sessions')
			return (res.data?.data ?? []).map(s => ({
				...s,
				sourceId: s.sourceId as string,
				courseId: s.courseId ? s.courseId as string : null,
			}))
		} catch {
			return []
		}
	},

	async createGeneralChatConversation(): Promise<GeneralChatConversation> {
		const res = await apiClient.post<{ data: GeneralChatConversation }>('/api/ai/chat/conversations', {
			title: 'New conversation',
		})
		return res.data.data
	},

	async getGeneralChatHistory(conversationId: string): Promise<ChatMessageDto[]> {
		const res = await apiClient.get<{ data: ChatMessageDto[] }>(`/api/ai/chat/conversations/${conversationId}/messages`)
		return res.data.data ?? []
	},

	async deleteGeneralChatConversation(conversationId: string): Promise<void> {
		await apiClient.delete(`/api/ai/chat/conversations/${conversationId}`)
	},

	async streamGeneralChatConversation(
		conversationId: string,
		message: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
		attachments?: ChatAttachment[],
	): Promise<void> {
		return streamSse(
			`/api/ai/chat/conversations/${conversationId}/stream`,
			attachments && attachments.length > 0 ? { message, attachments } : { message },
			onChunk,
			signal,
		)
	},

	// --- Document-based (these are already handled by the Documents API; kept for compatibility) ---

	async generateSummary(_text: string): Promise<string> {
		throw new Error('Use the Documents API to generate summaries from documents.')
	},

	async generateMindMap(_text: string): Promise<unknown> {
		throw new Error('Use the Documents API to generate mind maps from documents.')
	},

	async generateQuiz(_text: string): Promise<unknown> {
		throw new Error('Use the Documents API to generate quizzes from documents.')
	},

	async generateFlashcards(_text: string): Promise<unknown> {
		throw new Error('Use the Documents API to generate flashcards from documents.')
	},

	async chat(history: ChatHistoryEntry[], message: string): Promise<string> {
		return post<string>('/api/ai/chat', {
			message,
			history: toHistoryEntries(history),
		})
	},

	async streamChat(
		history: ChatHistoryEntry[],
		message: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse(
			'/api/ai/chat/stream',
			{ message, history: toHistoryEntries(history) },
			onChunk,
			signal,
		)
	},

	// --- YouTube-based ---

	async generateSummaryFromYouTube(videoUrl: string): Promise<string> {
		return post<string>('/api/videos/summary', { videoUrl })
	},

	async generateMindMapFromYouTube(videoUrl: string): Promise<string> {
		return post<string>('/api/videos/mindmap', { videoUrl })
	},

	async streamMindMapFromYouTube(
		videoUrl: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse('/api/videos/mindmap/stream', { videoUrl }, onChunk, signal)
	},

	async generateQuizFromYouTube(videoUrl: string): Promise<unknown> {
		const json = await post<string>('/api/videos/quiz', { videoUrl })
		return JSON.parse(json)
	},

	async generateFlashcardsFromYouTube(videoUrl: string): Promise<unknown> {
		const json = await post<string>('/api/videos/flashcards', { videoUrl })
		return JSON.parse(json)
	},

	async chatWithYouTube(
		videoUrl: string,
		history: ChatHistoryEntry[],
		message: string,
	): Promise<string> {
		return post<string>('/api/videos/chat', {
			videoUrl,
			message,
			history: toHistoryEntries(history),
		})
	},

	// kept for any code that still references this method
	async generateTranscriptFromYouTube(_videoUrl: string): Promise<string> {
		throw new Error('Use GET /api/videos/transcript instead.')
	},
}
