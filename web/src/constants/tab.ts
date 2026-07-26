import { CONTENT_TYPE_ICONS, STUDY_TYPE_ICONS } from './contentTypeIcons';

export const TABS = [
	{ id: 'summary' as const,   label: 'Summary',  icon: STUDY_TYPE_ICONS.summary.icon   },
	{ id: 'mindmap' as const,   label: 'Mind Map', icon: STUDY_TYPE_ICONS.mindmap.icon   },
	{ id: 'notes' as const,     label: 'Notes',    icon: STUDY_TYPE_ICONS.notes.icon     },
	{ id: 'flashcards' as const,label: 'Cards',    icon: STUDY_TYPE_ICONS.flashcard.icon },
	{ id: 'quiz' as const,      label: 'Quiz',     icon: STUDY_TYPE_ICONS.quiz.icon      },
	{ id: 'problems' as const,  label: 'Problems', icon: STUDY_TYPE_ICONS.problems.icon  },
	{ id: 'chat' as const,      label: 'AI Chat',  icon: STUDY_TYPE_ICONS.chat.icon      },
]

/**
 * Documents get one extra tab. It is not in TABS because articles, audio and video share that list
 * and have no extracted-text layer to show — only an uploaded file has one.
 *
 * Last on purpose: this is where a citation's "jump to source" lands, not somewhere people browse to.
 */
export const DOCUMENT_TABS = [
	...TABS,
	{ id: 'source' as const,    label: 'Source',   icon: CONTENT_TYPE_ICONS.document.icon },
]
