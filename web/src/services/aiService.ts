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

export interface ChatSessionSummary {
	sourceType: 'document' | 'video';
	sourceId: string;
	sourceName: string;
	courseId: string;
	lastMessage: string;
	lastMessageRole: string;
	updatedAt: string;
	messageCount: number;
}

export const aiService = {
	async getChatSessions(): Promise<ChatSessionSummary[]> {
		try {
			const res = await apiClient.get<{ data: ChatSessionSummary[] }>('/api/ai/chat/sessions')
			return (res.data?.data ?? []).map(s => ({
				...s,
				sourceId: s.sourceId as string,
				courseId: s.courseId as string,
			}))
		} catch {
			return []
		}
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
		return post<string>('/api/youtube/summary', { videoUrl })
	},

	async generateMindMapFromYouTube(videoUrl: string): Promise<string> {
		return post<string>('/api/youtube/mindmap', { videoUrl })
	},

	async streamMindMapFromYouTube(
		videoUrl: string,
		onChunk: (chunk: string) => void,
		signal?: AbortSignal,
	): Promise<void> {
		return streamSse('/api/youtube/mindmap/stream', { videoUrl }, onChunk, signal)
	},

	async generateQuizFromYouTube(videoUrl: string): Promise<unknown> {
		const json = await post<string>('/api/youtube/quiz', { videoUrl })
		return JSON.parse(json)
	},

	async generateFlashcardsFromYouTube(videoUrl: string): Promise<unknown> {
		const json = await post<string>('/api/youtube/flashcards', { videoUrl })
		return JSON.parse(json)
	},

	async chatWithYouTube(
		videoUrl: string,
		history: ChatHistoryEntry[],
		message: string,
	): Promise<string> {
		return post<string>('/api/youtube/chat', {
			videoUrl,
			message,
			history: toHistoryEntries(history),
		})
	},

	// kept for any code that still references this method
	async generateTranscriptFromYouTube(_videoUrl: string): Promise<string> {
		throw new Error('Use GET /api/youtube/transcript instead.')
	},
}
