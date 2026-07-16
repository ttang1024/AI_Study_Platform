export interface User {
	id: string
	email: string
	name: string
}

// Shared with rn/ via packages/core.
export type { Course } from '@core/types'

// Shared with rn/ via packages/core.
export type { Document } from '@core/types'

// Shared with rn/ via packages/core.
export type { Note } from '@core/types'

export interface ChatMessageAttachment {
	url: string
	mimeType: string
	fileName?: string
}

export interface ChatMessage {
	id: string
	role: 'user' | 'model'
	content: string
	timestamp: string
	attachments?: ChatMessageAttachment[]
}

/** One chat thread of a video or document (thread-switcher lists). */
export interface ChatThreadSummary {
	conversationId: string
	title: string
	createdAt: string
	updatedAt: string
	messageCount: number
	lastMessage: string | null
}

// Shared with rn/ via packages/core. Correct answer field is `correctAnswer`.
export type { QuizQuestion } from '@core/types'

// Shared with rn/ via packages/core.
export type { FlashcardSrsState } from '@core/types'

// Shared with rn/ via packages/core.
export type { Flashcard, OcclusionRect } from '@core/types'

export interface LearningProgress {
	documentId: string
	completionPercentage: number
	quizScores: {
		quizId: string
		score: number
		total: number
		date: string
	}[]
	timeSpent: number // in minutes
	lastAccessed: string
}

// ─── Glossary ────────────────────────────────────────────────────────────────
// Shared with rn/ via packages/core.
export type { GlossaryTerm } from '@core/types'

// ─── Adaptive Quiz Profile ───────────────────────────────────────────────────
export interface AdaptiveQuizProfile {
	documentId: string
	recentScores: number[]
	weakTopicKeywords: string[]
	difficultyLevel: 'easy' | 'medium' | 'hard'
}
