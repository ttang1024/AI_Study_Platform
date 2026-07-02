export interface User {
	id: string
	email: string
	name: string
}

export interface Course {
	id: string
	name: string
	color: string
	description?: string
}

export interface Document {
	title: string
	id: string
	name: string
	type: 'pdf' | 'docx' | 'txt' | 'md' | 'audio' | 'podcast' | 'image' | 'ppt' | 'epub'
	url: string
	uploadDate: string
	fileSize?: number
	fileHash?: string
	courseId?: string
	summary?: string
	mindMapText?: string
	transcript?: string
	originalUrl?: string
}

export interface Note {
	id: string
	documentId: string
	youTubeVideoId?: string
	documentName?: string
	videoName?: string
	content: string
	createdAt: string
}

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

export interface QuizQuestion {
	id: string
	question: string
	options?: string[]
	answer: string
	explanation: string
	type: 'multiple-choice' | 'short-answer'
	difficulty?: 'easy' | 'medium' | 'hard'
}

export interface FlashcardSrsState {
	state: 0 | 1 | 2 | 3    // 0=New, 1=Learning, 2=Review, 3=Relearning
	stability: number        // days of memory stability
	difficulty: number       // card difficulty 1–10
	reps: number
	lapses: number
	due: string              // ISO datetime
	lastReview?: string      // ISO datetime
	retrievability: number   // recall probability 0–1
}

export interface Flashcard {
	id: string
	documentId: string
	youTubeVideoId?: string
	documentName?: string
	videoName?: string
	front: string
	back: string
	cardType: 'basic' | 'cloze' | 'chart'
	difficulty: 'easy' | 'medium' | 'hard'
	chapter?: string
	tags: string[]
	lastReviewed?: string
	nextReview?: string
	srs?: FlashcardSrsState
}

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
export interface GlossaryTerm {
	id: string
	term: string
	definition: string
	documentId?: string
	youTubeVideoId?: string
	sourceName?: string // doc name or video title
	courseId?: string
	sourceKind?: 'document' | 'video' | 'article' | 'audio'
}

// ─── Shared Study Set ────────────────────────────────────────────────────────
export interface SharedSet {
	token: string
	title: string
	cards: { id: string; front: string; back: string }[]
	createdAt: string
	expiresAt?: string
}

// ─── Adaptive Quiz Profile ───────────────────────────────────────────────────
export interface AdaptiveQuizProfile {
	documentId: string
	recentScores: number[]
	weakTopicKeywords: string[]
	difficultyLevel: 'easy' | 'medium' | 'hard'
}
