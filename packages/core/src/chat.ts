// Chat DTOs shared by the document/video services (and web's chat UI stack).

/** An image/PDF attachment uploaded with a chat turn. `data` is raw base64 (no data: URL prefix). */
export interface ChatAttachment {
  mimeType: string;
  data: string;
  fileName?: string;
}

/** An attachment as displayed on a message. `url` is a presigned URL (history) or data: URL (optimistic). */
export interface ChatMessageAttachment {
  url: string;
  mimeType: string;
  fileName?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  attachments?: ChatMessageAttachment[];
}

/** One chat thread of a video or document (thread-switcher lists). */
export interface ChatThreadSummary {
  conversationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string | null;
}
