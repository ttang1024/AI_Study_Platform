import type { HttpClient } from '../http';
import type { SseStreamFn } from '../sse';
import type { Document, Flashcard, Note, PendingMaterial, QuizQuestion, SourceCitation } from '../types';
import { normalizeCitation } from '../types';
import type { ChatAttachment, ChatMessage, ChatThreadSummary } from '../chat';
import { mapPaged, type Paged } from '../paged';
import { createRequestCache } from '../requestCache';
import { parseOcclusions } from './flashcardService';

export interface QuizSubmission {
  submissionId: string;
  documentId: string;
  videoId?: string;
  sourceType?: string;
  documentName?: string;
  videoName?: string;
  answers: Record<string, string>;
  score: number;
  total: number;
  submittedAt: string;
}

export interface BackendDocument {
  documentId: string;
  courseId: string;
  userId?: string;
  fileName: string;
  blobUrl: string;
  contentType: string;
  fileSize?: number;
  fileHash?: string;
  summary?: string;
  mindMapText?: string | null;
  transcript?: string;
  originalUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

interface BackendNote {
  noteId: string;
  documentId: string;
  content: string;
  createdAt: string;
}

interface BackendChatMessage {
  messageId: string;
  role: 'user' | 'model' | 'assistant';
  content: string;
  createdAt: string;
  attachments?: { url: string; mimeType: string; fileName?: string }[] | null;
}

interface BackendQuiz {
  quizId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  citation?: SourceCitation;
}

interface BackendFlashcard {
  flashcardId: string;
  front: string;
  back: string;
  documentId?: string;
  cardType?: string;
  difficulty?: string;
  chapter?: string;
  tags?: string[];
  imageUrl?: string;
  occlusionsJson?: string;
}

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.m4b', '.wav', '.ogg', '.aac', '.flac', '.webm', '.opus', '.aiff', '.aif', '.wma', '.amr', '.mka'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.jfif', '.gif', '.webp', '.heic', '.heif', '.bmp', '.dib', '.svg'];
const PPT_EXTENSIONS = ['.ppt', '.pptx', '.pptm', '.potx', '.potm', '.pps', '.ppsx', '.ppsm', '.pot'];
const hasExtension = (name: string, extensions: readonly string[]) => extensions.some(ext => name.endsWith(ext));

// Formats with no client-side renderer — binary containers, and markup whose
// raw form is noise. The viewer shows the server-extracted plain text instead
// (GET .../documents/{id}/text). Anything with a viewer kind below is absent
// here on purpose: those are parsed from the original bytes.
const SERVER_EXTRACTED_EXTENSIONS = [
  ...PPT_EXTENSIONS,
  '.epub', '.mobi', '.azw', '.azw3', '.prc', '.pdb', '.fb2',
  '.doc', '.docm', '.dotx', '.dotm', '.dot', '.rtf', '.abw',
  '.xls', '.xlsx', '.xlsm', '.xlt', '.xltx', '.xltm',
  '.odt', '.odp', '.ods', '.odg', '.ott', '.otp', '.ots', '.otg',
  '.fodt', '.fodp', '.fods', '.sxw', '.sxi', '.sxc',
  '.pages', '.key', '.numbers',
  '.xps', '.oxps', '.vsdx',
  '.eml', '.mhtml', '.mht', '.msg', '.smi',
];

export const usesServerExtractedText = (doc: { type: string; name: string }): boolean => {
  if (doc.type === 'ppt' || doc.type === 'epub') return true;
  return hasExtension(doc.name.toLowerCase(), SERVER_EXTRACTED_EXTENSIONS);
};

/**
 * How the details page should render a document. This is deliberately separate
 * from `Document.type`, which stays a coarse category for icons, filtering and
 * routing — a `.py` upload is still a 'txt' document everywhere else in the app.
 */
export type DocumentViewerKind =
  | 'pdf' | 'docx' | 'image' | 'md' | 'code' | 'data' | 'table'
  | 'notebook' | 'subtitle' | 'html' | 'text';

const VIEWER_KIND_EXTENSIONS: [DocumentViewerKind, string[]][] = [
  ['md', ['.md', '.markdown', '.mdx', '.mdown', '.mkd', '.qmd', '.rmd']],
  ['table', ['.csv', '.tsv']],
  ['notebook', ['.ipynb']],
  ['html', ['.html', '.htm', '.xhtml']],
  ['subtitle', ['.srt', '.vtt', '.sbv', '.ass', '.ssa', '.sub', '.lrc', '.ttml', '.dfxp']],
  ['data', [
    '.json', '.jsonl', '.ndjson', '.json5', '.jsonc', '.yaml', '.yml', '.toml',
    '.xml', '.plist', '.opml', '.rss', '.atom', '.ini', '.cfg', '.conf',
    '.properties', '.avsc', '.edn',
  ]],
  ['code', [
    '.py', '.pyi', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts',
    '.vue', '.svelte', '.astro', '.coffee',
    '.java', '.kt', '.kts', '.scala', '.sbt', '.groovy', '.gradle',
    '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx', '.m', '.mm',
    '.cs', '.vb', '.fs', '.fsx', '.go', '.rs', '.swift', '.dart',
    '.rb', '.rake', '.gemspec', '.php', '.phtml', '.pl', '.pm', '.lua', '.r', '.jl',
    '.sql', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.bat', '.cmd', '.awk',
    '.ex', '.exs', '.erl', '.hrl', '.hs', '.clj', '.cljs', '.cljc',
    '.ml', '.mli', '.elm', '.rkt', '.scm', '.lisp', '.el', '.tcl', '.vim',
    '.nim', '.zig', '.d', '.pas', '.f90', '.f95', '.for', '.asm', '.s', '.ino',
    '.sol', '.tf', '.tfvars', '.hcl', '.proto', '.graphql', '.gql',
    '.cmake', '.mk', '.nix',
    '.css', '.scss', '.sass', '.less', '.styl',
    '.erb', '.ejs', '.hbs', '.mustache', '.jinja', '.j2', '.twig', '.liquid',
    '.pug', '.haml', '.slim',
    '.tex', '.ltx', '.sty', '.cls', '.bib', '.bbl',
  ]],
];

export const getDocumentViewerKind = (doc: { type: string; name: string }): DocumentViewerKind => {
  if (doc.type === 'pdf') return 'pdf';
  if (doc.type === 'docx') return 'docx';
  if (doc.type === 'image') return 'image';

  // Binary formats reach the viewer as extracted plain text, whatever their
  // extension would otherwise suggest.
  if (usesServerExtractedText(doc)) return 'text';

  const name = doc.name.toLowerCase();
  for (const [kind, extensions] of VIEWER_KIND_EXTENSIONS)
    if (hasExtension(name, extensions)) return kind;

  return doc.type === 'md' ? 'md' : 'text';
};

const getTypeFromContentTypeOrFileName = (
  contentType: string,
  fileName: string,
): 'pdf' | 'docx' | 'txt' | 'md' | 'audio' | 'podcast' | 'image' | 'ppt' | 'epub' => {
  const name = fileName.toLowerCase();
  if (contentType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  )
    return 'docx';
  if (
    contentType === 'text/markdown' ||
    contentType === 'text/x-markdown' ||
    name.endsWith('.md') ||
    name.endsWith('.markdown')
  )
    return 'md';
  if (
    contentType ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    contentType === 'application/vnd.ms-powerpoint' ||
    hasExtension(name, PPT_EXTENSIONS)
  )
    return 'ppt';
  if (contentType === 'application/epub+zip' || name.endsWith('.epub')) return 'epub';
  if (contentType.startsWith('image/') || hasExtension(name, IMAGE_EXTENSIONS))
    return 'image';
  if (contentType === 'audio/podcast') return 'podcast';
  if (contentType.startsWith('audio/') || hasExtension(name, AUDIO_EXTENSIONS))
    return 'audio';
  return 'txt';
};

export const mapDocument = (bd: BackendDocument): Document => ({
  id: bd.documentId,
  name: bd.fileName,
  title: bd.fileName,
  type: getTypeFromContentTypeOrFileName(bd.contentType, bd.fileName),
  url: bd.blobUrl,
  uploadDate: bd.createdAt,
  fileSize: bd.fileSize,
  fileHash: bd.fileHash,
  courseId: bd.courseId || undefined,
  summary: bd.summary,
  mindMapText: bd.mindMapText,
  transcript: bd.transcript,
  originalUrl: bd.originalUrl,
});

const mapNote = (bn: BackendNote): Note => ({
  id: bn.noteId,
  documentId: bn.documentId,
  content: bn.content,
  createdAt: bn.createdAt,
});

const mapChatMessage = (bm: BackendChatMessage): ChatMessage => ({
  id: bm.messageId,
  role: bm.role === 'assistant' ? 'model' : bm.role,
  content: bm.content,
  timestamp: bm.createdAt,
  attachments: bm.attachments ?? undefined,
});

export interface DocumentStaleness {
  documentId: string;
  contentVersion: number;
  sourceChangedAt?: string;
  staleFlashcards: number;
  staleQuizzes: number;
  staleGlossaryTerms: number;
  summaryStale: boolean;
  mindMapStale: boolean;
  hasStaleArtifacts: boolean;
}

const mapQuiz = (bq: BackendQuiz): QuizQuestion => ({
  id: bq.quizId,
  question: bq.question,
  options: Array.isArray(bq.options) ? bq.options : [],
  correctAnswer: bq.correctAnswer,
  explanation: bq.explanation,
  citation: normalizeCitation(bq.citation),
  type: 'multiple-choice',
  difficulty: bq.difficulty ?? 'medium',
});

const mapFlashcard = (bf: BackendFlashcard): Flashcard => ({
  id: bf.flashcardId,
  front: bf.front,
  back: bf.back,
  cardType: bf.cardType === 'cloze' || bf.cardType === 'chart' || bf.cardType === 'occlusion' ? bf.cardType : 'basic',
  difficulty: bf.difficulty === 'easy' || bf.difficulty === 'hard' ? bf.difficulty : 'medium',
  chapter: bf.chapter ?? undefined,
  tags: bf.tags ?? [],
  documentId: bf.documentId ?? undefined,
  imageUrl: bf.imageUrl ?? undefined,
  occlusions: parseOcclusions(bf.occlusionsJson),
});

const mapQuizSubmission = (bs: any): QuizSubmission => ({
  submissionId: bs.submissionId,
  documentId: bs.documentId,
  videoId: bs.videoId ?? undefined,
  sourceType: bs.sourceType ?? undefined,
  documentName: bs.document ?? (bs.sourceType === 'document' ? bs.title : undefined) ?? undefined,
  videoName: bs.video ?? (bs.sourceType === 'video' ? bs.title : undefined) ?? undefined,
  answers: bs.answers ?? {},
  score: bs.score,
  total: bs.total,
  submittedAt: bs.submittedAt,
});

export type PagedDocuments = Paged<Document>;

const DOCUMENT_LIST_CACHE_MS = 30_000;

export function createDocumentService(http: HttpClient, streamSse: SseStreamFn) {
  const documentListCache = createRequestCache<PagedDocuments>(DOCUMENT_LIST_CACHE_MS);
  const docPath = (courseId: string, documentId: string) => `/api/courses/${courseId}/documents/${documentId}`;

  /**
   * Drop cached document-list responses. Called after any list mutation, and on
   * auth changes (so one user's list never leaks to the next).
   */
  const invalidateDocumentListCache = (): void => documentListCache.clear();

  return {
    invalidateDocumentListCache,

    /** How much of this document's generated material predates its current source version. */
    getStaleness: (documentId: string) =>
      http.get<{ data: DocumentStaleness }>(`/api/documents/${documentId}/staleness`),

    /**
     * Replaces the document's file. Existing artifacts are kept but marked out of date —
     * regenerating is a separate, explicit step so a re-upload never discards review history.
     */
    replaceSource: (documentId: string, file: File | Blob, fileName: string) => {
      const form = new FormData();
      form.append('file', file, fileName);
      return http.put<{ data: DocumentStaleness }>(`/api/documents/${documentId}/source`, form);
    },

    regenerateStale: (
      documentId: string,
      kinds: { flashcards?: boolean; quizzes?: boolean; glossary?: boolean } = {},
    ) =>
      http.post<{ data: DocumentStaleness }>(`/api/documents/${documentId}/regenerate`, {
        flashcards: kinds.flashcards ?? true,
        quizzes: kinds.quizzes ?? true,
        glossary: kinds.glossary ?? true,
      }),


    async getAllDocuments(page = 1, pageSize = 3, courseId?: string): Promise<PagedDocuments> {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (courseId) params.set('courseId', courseId);
      const url = `/api/documents?${params}`;

      // Serve a fresh cached response — collapses the duplicate fetches that the
      // deferred context load and a page's own self-fetch would otherwise make.
      return documentListCache.get(url, () =>
        http.get<{ data: Paged<BackendDocument> }>(url).then(r => mapPaged(r.data.data, mapDocument)),
      );
    },

    async getDocuments(courseId: string): Promise<Document[]> {
      const response = await http.get<{ data: BackendDocument[] }>(`/api/courses/${courseId}/documents`);
      return response.data.data.map(mapDocument);
    },

    async getDocument(courseId: string, documentId: string): Promise<Document> {
      const response = await http.get<{ data: BackendDocument }>(docPath(courseId, documentId));
      return mapDocument(response.data.data);
    },

    // doc.url is the raw storage URI (e.g. s3://...) and isn't directly openable
    // by a browser tab or the rn audio player — this exchanges it for a
    // short-lived presigned HTTP(S) URL.
    async getDownloadUrl(courseId: string, documentId: string): Promise<string> {
      const response = await http.get<{ data: string }>(`${docPath(courseId, documentId)}/download-url`);
      return response.data.data;
    },

    /** Save a web article by URL (the web-clipper flow; also used by rn's summarizer). */
    async clipUrl(url: string, courseId: string): Promise<{ documentId: string; courseId: string }> {
      const response = await http.post<{ data: { documentId: string; courseId: string } }>('/api/documents/clip-url', { url, courseId });
      invalidateDocumentListCache();
      return response.data.data;
    },

    async deleteDocument(courseId: string, documentId: string): Promise<void> {
      await http.delete(docPath(courseId, documentId));
      invalidateDocumentListCache();
    },

    async moveDocument(
      courseId: string,
      documentId: string,
      targetCourseId: string,
    ): Promise<Document> {
      const response = await http.patch<{ data: BackendDocument }>(
        `${docPath(courseId, documentId)}/move`,
        { targetCourseId },
      );
      invalidateDocumentListCache();
      return mapDocument(response.data.data);
    },

    async updateDocument(
      courseId: string,
      documentId: string,
      data: { fileName: string },
    ): Promise<Document> {
      const response = await http.patch<{ data: BackendDocument }>(
        docPath(courseId, documentId),
        data,
      );
      invalidateDocumentListCache();
      return mapDocument(response.data.data);
    },

    /** Persist a user-edited summary (markdown) back to the document. */
    async updateSummary(courseId: string, documentId: string, summary: string): Promise<Document> {
      const response = await http.patch<{ data: BackendDocument }>(
        `${docPath(courseId, documentId)}/content`,
        { summary },
      );
      invalidateDocumentListCache();
      return mapDocument(response.data.data);
    },

    /** Persist a user-edited mind map (XMindMark/markdown source) back to the document. */
    async updateMindMap(
      courseId: string,
      documentId: string,
      mindMapText: string,
    ): Promise<Document> {
      const response = await http.patch<{ data: BackendDocument }>(
        `${docPath(courseId, documentId)}/content`,
        { mindMapText },
      );
      invalidateDocumentListCache();
      return mapDocument(response.data.data);
    },

    async generateQuiz(
      courseId: string,
      documentId: string,
      difficulty = 'medium',
    ): Promise<QuizQuestion[]> {
      const response = await http.post<{ data: BackendQuiz[] }>(
        `${docPath(courseId, documentId)}/quiz/generate?difficulty=${encodeURIComponent(difficulty)}`,
      );
      return response.data.data.map(mapQuiz);
    },

    /**
     * Asks the server to pick the difficulty and target the learner's weak spots, rather than making
     * them choose a level for themselves. The rationale explains the choice ("you're averaging 91%
     * here…") so the difficulty doesn't look arbitrary.
     */
    async generateAdaptiveQuiz(
      courseId: string,
      documentId: string,
    ): Promise<{ questions: QuizQuestion[]; rationale: string }> {
      const response = await http.post<{ data: BackendQuiz[]; message?: string }>(
        `${docPath(courseId, documentId)}/quiz/generate?difficulty=adaptive`,
      );
      return {
        questions: response.data.data.map(mapQuiz),
        rationale: response.data.message ?? '',
      };
    },

    async getQuiz(
      courseId: string,
      documentId: string,
      difficulty?: string,
    ): Promise<QuizQuestion[]> {
      const query = difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : '';
      const response = await http.get<{ data: BackendQuiz[] }>(
        `${docPath(courseId, documentId)}/quiz${query}`,
      );
      return response.data.data.map(mapQuiz);
    },

    async generateFlashcards(courseId: string, documentId: string): Promise<Flashcard[]> {
      const response = await http.post<{ data: BackendFlashcard[] }>(
        `${docPath(courseId, documentId)}/flashcards/generate`,
      );
      return response.data.data.map(bf => ({
        ...mapFlashcard(bf),
        documentId,
      }));
    },

    async getFlashcards(courseId: string, documentId: string): Promise<Flashcard[]> {
      const response = await http.get<{ data: BackendFlashcard[] }>(
        `${docPath(courseId, documentId)}/flashcards`,
      );
      return response.data.data.map(bf => ({
        ...mapFlashcard(bf),
        documentId,
      }));
    },

    async chat(courseId: string, documentId: string, message: string): Promise<string> {
      const response = await http.post<{ data: { content: string } }>(
        `${docPath(courseId, documentId)}/chat`,
        { message },
      );
      return response.data.data.content;
    },

    async streamSummary(
      courseId: string,
      documentId: string,
      onChunk: (chunk: string) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      return streamSse(
        `${docPath(courseId, documentId)}/summary/stream`,
        {},
        onChunk,
        signal,
      );
    },

    async streamMindMap(
      courseId: string,
      documentId: string,
      onChunk: (chunk: string) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      return streamSse(
        `${docPath(courseId, documentId)}/mindmap/stream`,
        {},
        onChunk,
        signal,
      );
    },

    async streamChat(
      courseId: string,
      documentId: string,
      message: string,
      onChunk: (chunk: string) => void,
      signal?: AbortSignal,
      attachments?: ChatAttachment[],
      conversationId?: string,
    ): Promise<void> {
      const body: Record<string, unknown> = { message };
      if (attachments && attachments.length > 0) body.attachments = attachments;
      if (conversationId) body.conversationId = conversationId;
      return streamSse(`${docPath(courseId, documentId)}/chat/stream`, body, onChunk, signal);
    },

    async getChatHistory(courseId: string, documentId: string): Promise<ChatMessage[]> {
      const response = await http.get<{ data: BackendChatMessage[] }>(
        `${docPath(courseId, documentId)}/chat`,
      );
      return response.data.data.map(mapChatMessage);
    },

    async deleteChatHistory(courseId: string, documentId: string): Promise<void> {
      await http.delete(`${docPath(courseId, documentId)}/chat`);
    },

    // ── Chat conversations (multiple threads per document) ─────────────────

    async listChatConversations(courseId: string, documentId: string): Promise<ChatThreadSummary[]> {
      const res = await http.get<{ data: ChatThreadSummary[] }>(
        `${docPath(courseId, documentId)}/chat/conversations`,
      );
      return res.data?.data ?? [];
    },

    async createChatConversation(courseId: string, documentId: string, title?: string): Promise<ChatThreadSummary> {
      const res = await http.post<{ data: ChatThreadSummary }>(
        `${docPath(courseId, documentId)}/chat/conversations`,
        { title: title ?? null },
      );
      return res.data.data;
    },

    async getConversationMessages(courseId: string, documentId: string, conversationId: string): Promise<ChatMessage[]> {
      const response = await http.get<{ data: BackendChatMessage[] }>(
        `${docPath(courseId, documentId)}/chat/conversations/${conversationId}`,
      );
      return response.data.data.map(mapChatMessage);
    },

    async deleteChatConversation(courseId: string, documentId: string, conversationId: string): Promise<void> {
      await http.delete(
        `${docPath(courseId, documentId)}/chat/conversations/${conversationId}`,
      );
    },

    async getNotes(courseId: string, documentId: string): Promise<Note[]> {
      const response = await http.get<{ data: BackendNote[] }>(
        `${docPath(courseId, documentId)}/notes`,
      );
      return response.data.data.map(mapNote);
    },

    async createNote(courseId: string, documentId: string, content: string): Promise<Note> {
      const response = await http.post<{ data: BackendNote }>(
        `${docPath(courseId, documentId)}/notes`,
        { content },
      );
      return mapNote(response.data.data);
    },

    async updateNote(
      courseId: string,
      documentId: string,
      noteId: string,
      content: string,
    ): Promise<Note> {
      const response = await http.put<{ data: BackendNote }>(
        `${docPath(courseId, documentId)}/notes/${noteId}`,
        { content },
      );
      return mapNote(response.data.data);
    },

    async deleteNote(courseId: string, documentId: string, noteId: string): Promise<void> {
      await http.delete(`${docPath(courseId, documentId)}/notes/${noteId}`);
    },

    /**
     * @param confidence Optional {questionId: 1|2|3} self-rating (1 = guessing, 3 = confident).
     *   Omitted when the learner rated nothing — the server treats absent as "no data", not "unsure".
     */
    async saveQuizSubmission(
      courseId: string,
      documentId: string,
      answers: Record<string, string>,
      score: number,
      total: number,
      confidence?: Record<string, number>,
    ): Promise<QuizSubmission> {
      const response = await http.post<{ data: unknown }>(
        `${docPath(courseId, documentId)}/quiz/submission`,
        { answers, score, total, confidence },
      );
      return mapQuizSubmission(response.data.data);
    },

    async getQuizSubmission(courseId: string, documentId: string): Promise<QuizSubmission | null> {
      const response = await http.get<{ data: unknown }>(
        `${docPath(courseId, documentId)}/quiz/submission`,
      );
      if (!response.data.data) return null;
      return mapQuizSubmission(response.data.data);
    },
  };
}

export type PagedQuizSubmissions = Paged<QuizSubmission>;

export interface QuizSubmissionCoverage {
  documentIds: string[];
  videoIds: string[];
}

const QUIZ_SUBMISSION_LIST_CACHE_MS = 2000;

export function createQuizSubmissionService(http: HttpClient) {
  const submissionListCache = createRequestCache<PagedQuizSubmissions>(QUIZ_SUBMISSION_LIST_CACHE_MS);
  const coverageRequests = createRequestCache<QuizSubmissionCoverage>();
  const materialRequests = createRequestCache<PendingMaterial[]>();

  const getMaterials = (url: string) =>
    materialRequests.get(url, () =>
      http.get<{ data: PendingMaterial[] | null }>(url).then(r => r.data.data ?? []),
    );

  return {
    getAllSubmissions(page = 1, pageSize = 20): Promise<PagedQuizSubmissions> {
      const url = `/api/quiz-submissions?page=${page}&pageSize=${pageSize}`;
      return submissionListCache.get(url, () =>
        http.get<{ data: Paged<unknown> }>(url).then(r => mapPaged(r.data.data, mapQuizSubmission)),
      );
    },

    getCoverage(): Promise<QuizSubmissionCoverage> {
      const url = '/api/quiz-submissions/coverage';
      return coverageRequests.get(url, () =>
        http.get<{ data: Partial<QuizSubmissionCoverage> }>(url).then(r => ({
          documentIds: r.data.data.documentIds ?? [],
          videoIds: r.data.data.videoIds ?? [],
        })),
      );
    },

    getPendingMaterials: () => getMaterials('/api/quiz-submissions/pending-materials'),

    getGeneratedMaterials: () => getMaterials('/api/quiz-submissions/generated-materials'),

    clearListCache() {
      submissionListCache.clear();
    },
  };
}
