import type { ChatMessageAttachment } from '../../services/aiService';

/** A chat message rendered by ChatPanel (context, external, or local-fallback). */
export interface ChatPanelMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
  attachments?: ChatMessageAttachment[];
}
