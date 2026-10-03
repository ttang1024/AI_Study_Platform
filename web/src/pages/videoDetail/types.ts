import type { ChatMessageAttachment } from '../../services/aiService';

export type { SelectionToolbar } from '../../hooks/useSelectionToolbar';
export interface SimpleCard { id: string; front: string; back: string; cardType?: 'basic' | 'cloze' | 'chart' | 'occlusion'; }
export interface ChatMsg { id: string; role: 'user' | 'model'; content: string; isError?: boolean; attachments?: ChatMessageAttachment[]; }
export type VideoStudyTab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'problems' | 'chat';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface VideoDetailLocationState {
  activeTab?: VideoStudyTab;
  returnTo?: string;
  targetQuizQuestionId?: string;
}
