import type { HttpClient } from '../http';
import type { SseStreamFn } from '../sse';
import type { VideoSourceType } from '../videoSources';
import type { ChatAttachment, ChatMessageAttachment, ChatThreadSummary } from '../chat';

// --- Types ---

export interface VideoListItem {
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  videoId: string;
  videoUrl: string;
  sourceType?: VideoSourceType;
  title: string;
  thumbnailUrl: string;
  summary: string | null;
  noteContent: string | null;
  flashcardsJson: string | null;
  quizJson: string | null;
  createdAt: string;
}

export interface PagedVideos {
  items: VideoListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface VideoDetail {
  id: string;
  courseId: string;
  videoId: string;
  videoUrl: string;
  sourceType?: VideoSourceType;
  title: string;
  thumbnailUrl: string;
  summary: string | null;
  mindMapText: string | null;
  flashcardsJson: string | null;
  createdAt: string;
}

export interface VideoFlashcard {
  flashcardId: string;
  front: string;
  back: string;
  cardType?: 'basic' | 'cloze' | 'chart' | 'occlusion';
  difficulty?: 'easy' | 'medium' | 'hard';
  chapter?: string;
  tags?: string[];
}

export interface VideoQuizItem {
  quizId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface TranscriptSegment {
  startSeconds: number;
  text: string;
}

export interface VideoNoteResult {
  noteId: string;
  content: string;
}

export interface PlaylistVideoItemData {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  videoUrl?: string;
}

export interface CreateVideoData {
  courseId: string;
  videoId: string;
  videoUrl: string;
  sourceType?: VideoSourceType;
  title: string;
  thumbnailUrl: string;
  summary: null;
}

export interface GetVideosParams {
  page?: number;
  pageSize?: number;
  courseId?: string | null;
  search?: string;
}

export interface VideoChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  attachments?: ChatMessageAttachment[];
}

export type VideoChatConversation = ChatThreadSummary;

function mapConversation(c: any): VideoChatConversation {
  return {
    conversationId: c.conversationId,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messageCount ?? 0,
    lastMessage: c.lastMessage ?? null,
  };
}

function mapVideoChatMessage(m: any): VideoChatMessage {
  return {
    id: m.messageId,
    role: m.role === 'assistant' ? 'model' : (m.role as 'user' | 'model'),
    content: m.content,
    attachments: m.attachments ?? undefined,
  };
}

// --- Service ---

const VIDEO_LIST_TTL_MS = 30_000;
const VIDEO_API = '/api/videos';

export function createVideoService(http: HttpClient, streamSse: SseStreamFn) {
  const inflightVideoListRequests = new Map<string, Promise<PagedVideos>>();
  const videoListCache = new Map<string, { ts: number; data: PagedVideos }>();

  /**
   * Drop all cached video-list responses. Call after any mutation that changes the
   * list, and on auth changes (so one user's list never leaks to the next).
   */
  const invalidateVideoListCache = (): void => {
    videoListCache.clear();
    inflightVideoListRequests.clear();
  };

  const getVideoNotes = async (
    videoRecordId: string,
  ): Promise<Array<{ noteId: string; videoId?: string; content: string; createdAt: string; updatedAt?: string }>> => {
    const res = await http.get<{ data: any[] }>(`${VIDEO_API}/${videoRecordId}/notes`);
    return res.data?.data ?? [];
  };

  return {
    invalidateVideoListCache,

    async getVideos(params: GetVideosParams = {}): Promise<PagedVideos> {
      const p = new URLSearchParams({
        page: String(params.page ?? 1),
        pageSize: String(params.pageSize ?? 8),
      });
      if (params.courseId) p.set('courseId', params.courseId);
      if (params.search) p.set('search', params.search);
      const url = `${VIDEO_API}?${p}`;

      // Serve a fresh cached response — this collapses the repeated identical
      // fetches different pages fire on mount when navigating between them.
      const cached = videoListCache.get(url);
      if (cached && Date.now() - cached.ts < VIDEO_LIST_TTL_MS) return cached.data;

      // In-flight dedupe for concurrent callers of the same query.
      const pending = inflightVideoListRequests.get(url);
      if (pending) return pending;

      const request = http
        .get<{ data: PagedVideos }>(url)
        .then(res => {
          videoListCache.set(url, { ts: Date.now(), data: res.data.data });
          return res.data.data;
        })
        .finally(() => inflightVideoListRequests.delete(url));

      inflightVideoListRequests.set(url, request);
      return request;
    },

    /**
     * Lightweight video list (no summary/mind-map blobs) for "fetch all videos to
     * label content" callers. Shares the list cache/dedupe with getVideos — keyed by
     * URL, so /api/videos/lite is a distinct entry and invalidateVideoListCache clears
     * both. Returns the same PagedVideos shape with the heavy fields nulled, so callers
     * typed against VideoListItem need no changes.
     */
    async getVideosLite(params: { page?: number; pageSize?: number } = {}): Promise<PagedVideos> {
      const p = new URLSearchParams({
        page: String(params.page ?? 1),
        pageSize: String(params.pageSize ?? 500),
      });
      const url = `${VIDEO_API}/lite?${p}`;

      const cached = videoListCache.get(url);
      if (cached && Date.now() - cached.ts < VIDEO_LIST_TTL_MS) return cached.data;

      const pending = inflightVideoListRequests.get(url);
      if (pending) return pending;

      const request = http
        .get<{ data: PagedVideos }>(url)
        .then(res => {
          const raw = res.data.data;
          const data: PagedVideos = {
            ...raw,
            items: raw.items.map(v => ({
              ...v,
              summary: null,
              noteContent: null,
              flashcardsJson: null,
              quizJson: null,
            })),
          };
          videoListCache.set(url, { ts: Date.now(), data });
          return data;
        })
        .finally(() => inflightVideoListRequests.delete(url));

      inflightVideoListRequests.set(url, request);
      return request;
    },

    async getVideo(id: string): Promise<VideoDetail> {
      const res = await http.get<{ data: VideoDetail }>(`${VIDEO_API}/${id}`);
      return res.data.data;
    },

    async createVideo(data: CreateVideoData): Promise<VideoDetail> {
      const res = await http.post<{ data: VideoDetail }>(VIDEO_API, data);
      invalidateVideoListCache();
      return res.data.data;
    },

    async getPlaybackUrl(videoRecordId: string): Promise<string> {
      const res = await http.get<{ data: string }>(`${VIDEO_API}/${videoRecordId}/playback-url`);
      return res.data.data;
    },

    async getVideoMetadata(videoUrl: string): Promise<{ title: string; thumbnailUrl: string } | null> {
      try {
        const res = await http.get<{ data: { title: string; thumbnailUrl: string } }>(
          `${VIDEO_API}/video-metadata?videoUrl=${encodeURIComponent(videoUrl)}`,
        );
        return res.data.data ?? null;
      } catch {
        return null;
      }
    },

    async getPlaylistItems(playlistId: string): Promise<PlaylistVideoItemData[]> {
      const res = await http.get<{ data: PlaylistVideoItemData[] }>(
        `${VIDEO_API}/playlist-items?playlistId=${encodeURIComponent(playlistId)}`,
      );
      return res.data.data ?? [];
    },

    async getBilibiliItems(videoUrl: string): Promise<PlaylistVideoItemData[]> {
      const res = await http.get<{ data: PlaylistVideoItemData[] }>(
        `${VIDEO_API}/bilibili-items?videoUrl=${encodeURIComponent(videoUrl)}`,
      );
      return res.data.data ?? [];
    },

    async updateVideo(id: string, data: Record<string, unknown>): Promise<VideoListItem> {
      const res = await http.patch<{ data: VideoListItem }>(`${VIDEO_API}/${id}`, data);
      invalidateVideoListCache();
      return res.data.data;
    },

    async deleteVideo(id: string): Promise<void> {
      await http.delete(`${VIDEO_API}/${id}`);
      invalidateVideoListCache();
    },

    async moveVideo(id: string, targetCourseId: string): Promise<void> {
      await http.patch(`${VIDEO_API}/${id}/move`, { targetCourseId });
      invalidateVideoListCache();
    },

    async getFlashcards(videoId: string): Promise<VideoFlashcard[]> {
      const res = await http.get<{ data: VideoFlashcard[] }>(
        `${VIDEO_API}/${videoId}/flashcards`,
      );
      return res.data.data ?? [];
    },

    async generateFlashcards(videoId: string, videoUrl: string): Promise<VideoFlashcard[]> {
      const res = await http.post<{ data: VideoFlashcard[] }>(
        `${VIDEO_API}/${videoId}/flashcards/generate`,
        { videoUrl },
      );
      return res.data.data ?? [];
    },

    async getQuiz(videoId: string, difficulty?: string): Promise<VideoQuizItem[]> {
      const query = difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : '';
      const res = await http.get<{ data: VideoQuizItem[] }>(
        `${VIDEO_API}/${videoId}/quiz${query}`,
      );
      return res.data.data ?? [];
    },

    async generateQuiz(videoId: string, videoUrl: string, difficulty = 'medium'): Promise<VideoQuizItem[]> {
      const res = await http.post<{ data: VideoQuizItem[] }>(
        `${VIDEO_API}/${videoId}/quiz/generate?difficulty=${encodeURIComponent(difficulty)}`,
        { videoUrl },
      );
      return res.data.data ?? [];
    },

    /** Captions for a YouTube video, keyed by its source video id (the backend falls back to raw subtitles). */
    async getTranscript(videoId: string): Promise<TranscriptSegment[]> {
      const res = await http.get<{ data: TranscriptSegment[] }>(
        `${VIDEO_API}/transcript?videoId=${encodeURIComponent(videoId)}`,
      );
      return res.data.data ?? [];
    },

    /** Captions for a saved video record (non-YouTube sources), keyed by its record id. */
    async getVideoTranscript(videoRecordId: string): Promise<TranscriptSegment[]> {
      const res = await http.get<{ data: TranscriptSegment[] }>(
        `${VIDEO_API}/${videoRecordId}/transcript`,
      );
      return res.data.data ?? [];
    },

    async getSubtitles(videoId: string): Promise<TranscriptSegment[]> {
      const res = await http.get<{ data: TranscriptSegment[] }>(
        `${VIDEO_API}/subtitles?videoId=${encodeURIComponent(videoId)}`,
      );
      return res.data.data ?? [];
    },

    async getVideoSubtitles(videoRecordId: string): Promise<TranscriptSegment[]> {
      const res = await http.get<{ data: TranscriptSegment[] }>(
        `${VIDEO_API}/${videoRecordId}/subtitles`,
      );
      return res.data.data ?? [];
    },

    async getVideoNote(videoRecordId: string): Promise<VideoNoteResult | null> {
      const notes = await getVideoNotes(videoRecordId);
      const note = notes[0];
      return note ? { noteId: note.noteId, content: note.content ?? '' } : null;
    },

    getVideoNotes,

    async createNote(content: string, videoId: string): Promise<VideoNoteResult> {
      const res = await http.post<{ data: { noteId: string; content: string } }>(
        '/api/notes',
        { content, videoId },
      );
      return { noteId: res.data.data.noteId, content: res.data.data.content };
    },

    async updateNote(noteId: string, content: string): Promise<void> {
      await http.put(`/api/notes/${noteId}`, { content });
    },

    async submitQuiz(
      videoId: string,
      answers: Record<string, string>,
      score: number,
      total: number,
    ): Promise<void> {
      await http.post(`${VIDEO_API}/${videoId}/quiz/submit`, {
        answers,
        score,
        total,
      });
    },

    async getVideoGlossary(
      videoId: string,
    ): Promise<Array<{ id: string; term: string; definition: string }>> {
      try {
        const res = await http.get<{ data: any[] }>(
          `${VIDEO_API}/${videoId}/glossary`,
        );
        return (res.data?.data ?? []).map((t: any) => ({
          id: t.id,
          term: t.term,
          definition: t.definition,
        }));
      } catch {
        return [];
      }
    },

    async generateVideoGlossary(
      videoId: string,
      videoUrl: string,
    ): Promise<Array<{ id: string; term: string; definition: string }>> {
      const res = await http.post<{ data: any[] }>(
        `${VIDEO_API}/${videoId}/glossary/generate`,
        { videoUrl },
      );
      return (res.data?.data ?? []).map((t: any) => ({
        id: t.id,
        term: t.term,
        definition: t.definition,
      }));
    },

    async getQuizSubmission(
      videoId: string,
    ): Promise<{ answers: Record<string, string>; score: number; total: number } | null> {
      const res = await http.get<{ data: any }>(
        `${VIDEO_API}/${videoId}/quiz/submission`,
      );
      const data = res.data?.data;
      if (!data) return null;
      return { answers: data.answers ?? {}, score: data.score, total: data.total };
    },

    async getChatHistory(videoId: string): Promise<VideoChatMessage[]> {
      const res = await http.get<{ data: any[] }>(`${VIDEO_API}/${videoId}/chat`);
      return (res.data?.data ?? []).map(mapVideoChatMessage);
    },

    async deleteChatHistory(videoId: string): Promise<void> {
      await http.delete(`${VIDEO_API}/${videoId}/chat`);
    },

    // ── Chat conversations (multiple threads per video) ────────────────────

    async listChatConversations(videoId: string): Promise<VideoChatConversation[]> {
      const res = await http.get<{ data: any[] }>(`${VIDEO_API}/${videoId}/chat/conversations`);
      return (res.data?.data ?? []).map(mapConversation);
    },

    async createChatConversation(videoId: string, title?: string): Promise<VideoChatConversation> {
      const res = await http.post<{ data: any }>(`${VIDEO_API}/${videoId}/chat/conversations`, {
        title: title ?? null,
      });
      return mapConversation(res.data.data);
    },

    async getConversationMessages(
      videoId: string,
      conversationId: string,
    ): Promise<VideoChatMessage[]> {
      const res = await http.get<{ data: any[] }>(
        `${VIDEO_API}/${videoId}/chat/conversations/${conversationId}`,
      );
      return (res.data?.data ?? []).map(mapVideoChatMessage);
    },

    async deleteChatConversation(videoId: string, conversationId: string): Promise<void> {
      await http.delete(`${VIDEO_API}/${videoId}/chat/conversations/${conversationId}`);
    },

    async sendChat(
      videoId: string,
      message: string,
    ): Promise<{ id: string; role: 'user' | 'model'; content: string }> {
      const res = await http.post<{ data: any }>(`${VIDEO_API}/${videoId}/chat`, {
        message,
      });
      const m = res.data.data;
      return { id: m.messageId, role: 'model', content: m.content };
    },

    /** Summarize by URL (unsaved video — the summarizer's live preview). */
    async streamSummary(
      videoUrl: string,
      onChunk: (chunk: string) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      return streamSse(`${VIDEO_API}/summary/stream`, { videoUrl }, onChunk, signal);
    },

    /** No non-streaming summary endpoint exists for saved videos; consume the SSE stream and accumulate chunks. */
    async streamVideoSummary(
      videoRecordId: string,
      onChunk: (chunk: string) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      return streamSse(`${VIDEO_API}/${videoRecordId}/summary/stream`, {}, onChunk, signal);
    },

    async streamVideoMindMap(
      videoRecordId: string,
      onChunk: (chunk: string) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      return streamSse(`${VIDEO_API}/${videoRecordId}/mindmap/stream`, {}, onChunk, signal);
    },

    async streamChat(
      videoId: string,
      message: string,
      onChunk: (chunk: string) => void,
      signal?: AbortSignal,
      attachments?: ChatAttachment[],
      conversationId?: string,
    ): Promise<void> {
      const body: Record<string, unknown> = { message };
      if (attachments && attachments.length > 0) body.attachments = attachments;
      if (conversationId) body.conversationId = conversationId;
      return streamSse(`${VIDEO_API}/${videoId}/chat/stream`, body, onChunk, signal);
    },
  };
}
