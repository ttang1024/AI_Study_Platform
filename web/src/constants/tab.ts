import { STUDY_TYPE_ICONS } from './contentTypeIcons';

export const TABS = [
	{ id: 'summary' as const,   label: 'Summary',  icon: STUDY_TYPE_ICONS.summary.icon   },
	{ id: 'mindmap' as const,   label: 'Mind Map', icon: STUDY_TYPE_ICONS.mindmap.icon   },
	{ id: 'notes' as const,     label: 'Notes',    icon: STUDY_TYPE_ICONS.notes.icon     },
	{ id: 'flashcards' as const,label: 'Cards',    icon: STUDY_TYPE_ICONS.flashcard.icon },
	{ id: 'quiz' as const,      label: 'Quiz',     icon: STUDY_TYPE_ICONS.quiz.icon      },
	{ id: 'problems' as const,  label: 'Problems', icon: STUDY_TYPE_ICONS.problems.icon  },
	{ id: 'chat' as const,      label: 'AI Chat',  icon: STUDY_TYPE_ICONS.chat.icon      },
]
