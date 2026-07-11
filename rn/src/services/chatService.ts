import { apiClient } from '@/services/apiClient';
import { streamSse } from '@/services/sse';

export interface ChatSessionSummary {
  sourceType: 'document' | 'video' | 'general';
  sourceId: string;
  sourceName: string;
  courseId: string | null;
  conversationId: string;
  conversationTitle: string;
  lastMessage: string;
  lastMessageRole: string;
  updatedAt: string;
  messageCount: number;
}

export interface GeneralChatConversation {
  conversationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// Outgoing (composer → server): raw base64, no `data:` URL prefix.
export interface ChatAttachment {
  mimeType: string;
  data: string;
  fileName?: string;
}

// Rendered (server history, or optimistic local echo of a just-sent message):
// `url` is a presigned blob URL for history, or a `data:` URL for the optimistic bubble.
export interface ChatMessageAttachment {
  url: string;
  mimeType: string;
  fileName?: string;
}

export interface ChatMessageDto {
  messageId: string;
  role: 'user' | 'assistant' | 'model';
  content: string;
  createdAt: string;
  attachments?: ChatMessageAttachment[] | null;
}

export interface ChatThreadSummary {
  conversationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string | null;
}

export type ChatScopeType = 'document' | 'video';

// Documents scope chat under their course; videos don't need a courseId in the path.
const scopedBase = (sourceType: ChatScopeType, sourceId: string, courseId?: string): string =>
  sourceType === 'document' ? `/api/courses/${courseId}/documents/${sourceId}` : `/api/videos/${sourceId}`;

export const chatService = {
  async getSessions(): Promise<ChatSessionSummary[]> {
    try {
      const res = await apiClient.get<{ data: ChatSessionSummary[] }>('/api/ai/chat/sessions');
      return res.data?.data ?? [];
    } catch {
      return [];
    }
  },

  async createConversation(): Promise<GeneralChatConversation> {
    const res = await apiClient.post<{ data: GeneralChatConversation }>('/api/ai/chat/conversations', {
      title: 'New conversation',
    });
    return res.data.data;
  },

  async getMessages(conversationId: string): Promise<ChatMessageDto[]> {
    const res = await apiClient.get<{ data: ChatMessageDto[] }>(`/api/ai/chat/conversations/${conversationId}/messages`);
    return res.data.data ?? [];
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/api/ai/chat/conversations/${conversationId}`);
  },

  async streamMessage(
    conversationId: string,
    message: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    attachments?: ChatAttachment[],
  ): Promise<void> {
    const body = attachments?.length ? { message, attachments } : { message };
    return streamSse(`/api/ai/chat/conversations/${conversationId}/stream`, body, onChunk, signal);
  },

  async listThreads(sourceType: ChatScopeType, sourceId: string, courseId?: string): Promise<ChatThreadSummary[]> {
    const res = await apiClient.get<{ data: ChatThreadSummary[] }>(`${scopedBase(sourceType, sourceId, courseId)}/chat/conversations`);
    return res.data.data ?? [];
  },

  async createThread(sourceType: ChatScopeType, sourceId: string, courseId?: string, title?: string): Promise<ChatThreadSummary> {
    const res = await apiClient.post<{ data: ChatThreadSummary }>(`${scopedBase(sourceType, sourceId, courseId)}/chat/conversations`, { title });
    return res.data.data;
  },

  async getThreadMessages(sourceType: ChatScopeType, sourceId: string, courseId: string | undefined, conversationId: string): Promise<ChatMessageDto[]> {
    const res = await apiClient.get<{ data: ChatMessageDto[] }>(`${scopedBase(sourceType, sourceId, courseId)}/chat/conversations/${conversationId}`);
    return res.data.data ?? [];
  },

  async deleteThread(sourceType: ChatScopeType, sourceId: string, courseId: string | undefined, conversationId: string): Promise<void> {
    await apiClient.delete(`${scopedBase(sourceType, sourceId, courseId)}/chat/conversations/${conversationId}`);
  },

  async streamThreadMessage(
    sourceType: ChatScopeType,
    sourceId: string,
    courseId: string | undefined,
    conversationId: string,
    message: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    attachments?: ChatAttachment[],
  ): Promise<void> {
    const body: Record<string, unknown> = { message, conversationId };
    if (attachments?.length) body.attachments = attachments;
    return streamSse(`${scopedBase(sourceType, sourceId, courseId)}/chat/stream`, body, onChunk, signal);
  },
};
