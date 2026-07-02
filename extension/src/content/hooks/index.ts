// Barrel for the panel's hooks. Each hook owns one concern (video id, status,
// captions, streamed text, chat, library) in its own file; import from here.

export { useVideoId } from './useVideoId'
export { useStatus } from './useStatus'
export { useTranscript, type Captions } from './useCaptions'
export { useStreamText } from './useStreamText'
export {
	useChat,
	type ChatMessage,
	type ChatAttachment,
	type ChatMessageAttachment,
	type ConversationSummary,
} from './useChat'
export { useLibrary, type LibraryContent } from './useLibrary'
export { useReadAloud } from './useReadAloud'
export { useVoiceInput } from './useVoiceInput'
