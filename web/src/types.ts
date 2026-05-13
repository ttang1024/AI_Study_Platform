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
	type: 'pdf' | 'docx' | 'txt' | 'md' | 'audio' | 'podcast'
	url: string
	uploadDate: string
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

export interface ChatMessage {
	id: string
	role: 'user' | 'model'
	content: string
	timestamp: string
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

export interface Flashcard {
	id: string
	documentId: string
	youTubeVideoId?: string
	documentName?: string
	videoName?: string
	front: string
	back: string
	difficulty: 'easy' | 'medium' | 'hard'
	lastReviewed?: string
	nextReview?: string
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
