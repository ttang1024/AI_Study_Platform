import {
  FileText, Youtube, Mic, Globe, Rss,
  Sparkles, Brain, NotebookPen, BrainCircuit, Award, Calculator, MessageCircle, BookMarked,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ContentType = 'video' | 'document' | 'audio' | 'article' | 'podcast';

export interface ContentTypeIconConfig {
  icon: LucideIcon;
  color: string;
  label: string;
  emoji: string;
}

export const CONTENT_TYPE_ICONS: Record<ContentType, ContentTypeIconConfig> = {
  video:    { icon: Youtube,  color: '#ef4444', label: 'Video',    emoji: '▶' },
  document: { icon: FileText, color: '#2563eb', label: 'Document', emoji: '📄' },
  audio:    { icon: Mic,      color: '#f59e0b', label: 'Audio',    emoji: '🎙️' },
  article:  { icon: Globe,    color: '#14b8a6', label: 'Article',  emoji: '🌐' },
  podcast:  { icon: Rss,      color: '#c026d3', label: 'Podcast',  emoji: '🎧' },
};

export type StudyType = 'summary' | 'mindmap' | 'notes' | 'flashcard' | 'quiz' | 'problems' | 'chat' | 'glossary';

export interface StudyTypeIconConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
}

export const STUDY_TYPE_ICONS: Record<StudyType, StudyTypeIconConfig> = {
  summary:   { icon: Sparkles,      color: '#ef4444', bg: '#fef2f2', label: 'Summary'   }, // red
  notes:     { icon: NotebookPen,   color: '#f97316', bg: '#fff7ed', label: 'Notes'     }, // orange
  flashcard: { icon: BrainCircuit,  color: '#eab308', bg: '#fefce8', label: 'Flashcard' }, // yellow
  quiz:      { icon: Award,         color: '#22c55e', bg: '#f0fdf4', label: 'Quiz'      }, // green
  glossary:  { icon: BookMarked,    color: '#14b8a6', bg: '#f0fdfa', label: 'Glossary'  }, // teal
  problems:  { icon: Calculator,    color: '#3b82f6', bg: '#eff6ff', label: 'Problems'  }, // blue
  mindmap:   { icon: Brain,         color: '#8b5cf6', bg: '#f5f3ff', label: 'Mind Map'  }, // violet
  chat:      { icon: MessageCircle, color: '#ec4899', bg: '#fdf2f8', label: 'AI Chat'   }, // pink
};
