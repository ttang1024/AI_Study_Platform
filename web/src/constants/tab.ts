import {
	Sparkles,
	Brain,
	ListTodo,
	BrainCircuit,
	Award,
	MessageCircle,
	Calculator,
} from 'lucide-react'

export const TABS = [
	{ id: 'summary' as const, label: 'Summary', icon: Sparkles },
	{ id: 'mindmap' as const, label: 'Mind Map', icon: Brain },
	{ id: 'notes' as const, label: 'Notes', icon: ListTodo },
	{ id: 'flashcards' as const, label: 'Cards', icon: BrainCircuit },
	{ id: 'quiz' as const, label: 'Quiz', icon: Award },
	{ id: 'problems' as const, label: 'Problems', icon: Calculator },
	{ id: 'chat' as const, label: 'AI Chat', icon: MessageCircle },
]
