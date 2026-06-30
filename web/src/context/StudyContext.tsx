import React, { createContext, useContext, useState, useEffect } from 'react';
import { Document, Note, ChatMessage, Course, Flashcard, LearningProgress } from '../types';
import { courseService } from '../services/courseService';
import { documentService, quizSubmissionService, QuizSubmission, invalidateDocumentListCache } from '../services/documentService';
import { VideoListItem, invalidateVideoListCache, videoService } from '../services/videoService';
import { noteService } from '../services/noteService';
import { flashcardService, invalidateFlashcardListCache } from '../services/flashcardService';
import { AchievementStats as ServerAchievementStats, CourseMaterialStats, statsService } from '../services/statsService';
import { invalidateDashboardSummaryCache } from '../services/analyticsService';
import { offlineCacheService, isOffline } from '../services/offlineCacheService';
import { useAuth } from './AuthContext';

// "Fetch all" pages have no real page boundary — we want the whole set in one
// request. Sizing by the known total (from stats) avoids both truncation when
// the user has more than a fixed cap and over-fetching when they have few.
// The floor keeps the first request useful before/if stats are unavailable.
const FETCH_ALL_FLOOR = 50;
const fetchAllSize = (total: number) => Math.max(total, FETCH_ALL_FLOOR);

interface StudyContextType {
  isLoading: boolean;
  documents: Document[];
  videos: VideoListItem[];
  videosLoading: boolean;
  totalDocuments: number;
  totalArticles: number;
  totalAudio: number;
  totalNotes: number;
  totalFlashcards: number;
  totalGlossaryTerms: number;
  totalQuizQuestions: number;
  totalQuizSubmissions: number;
  totalVideos: number;
  totalMaterials: number;
  courseMaterialCounts: CourseMaterialStats[];
  achievementStats: ServerAchievementStats;
  currentDocument: Document | null;
  setCurrentDocument: (doc: Document | null | ((prev: Document | null) => Document | null)) => void;
  addDocument: (file: File, courseId: string) => Promise<string>;
  deleteDocument: (courseId: string, documentId: string) => Promise<void>;
  deleteVideo: (videoId: string) => Promise<void>;
  updateDocumentInList: (doc: Document) => void;
  allNotes: Note[];
  addNote: (content: string) => Promise<void>;
  updateNote: (id: string, content: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  chatMessages: ChatMessage[];
  addChatMessage: (role: 'user' | 'model', content: string) => Promise<void>;
  aiInput: string;
  setAiInput: React.Dispatch<React.SetStateAction<string>>;
  noteInput: string;
  setNoteInput: React.Dispatch<React.SetStateAction<string>>;
  courses: Course[];
  addCourse: (name: string, color: string) => Promise<void>;
  updateCourse: (id: string, name: string, color: string) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  flashcards: Flashcard[];
  setFlashcards: React.Dispatch<React.SetStateAction<Flashcard[]>>;
  addFlashcard: (front: string, back: string) => Promise<void>;
  progress: LearningProgress[];
  updateProgress: (docId: string, updates: Partial<LearningProgress>) => void;
  quizSubmissions: QuizSubmission[];
  refreshStats: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  refreshFlashcards: () => Promise<void>;
  refreshQuizSubmissions: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  refreshVideos: () => Promise<void>;
  ensureDocuments: () => Promise<void>;
  ensureFlashcards: () => Promise<void>;
  ensureVideos: () => Promise<void>;
  ensureNotes: () => Promise<void>;
  ensureQuizSubmissions: () => Promise<void>;
  resetData: () => void;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

const EMPTY_ACHIEVEMENT_STATS: ServerAchievementStats = {
  perfectQuizzes: 0,
  averageQuizScore: 0,
  flashcardsMastered: 0,
};

const EMPTY_STATS = {
  totalDocuments: 0,
  totalArticles: 0,
  totalAudio: 0,
  totalMaterials: 0,
  totalNotes: 0,
  totalFlashcards: 0,
  totalGlossaryTerms: 0,
  totalQuizQuestions: 0,
  totalQuizSubmissions: 0,
  totalVideos: 0,
  courseMaterialCounts: [] as CourseMaterialStats[],
  achievements: EMPTY_ACHIEVEMENT_STATS,
};

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  // Lazy: starts false; flips true only while ensureVideos() is actually fetching.
  const [videosLoading, setVideosLoading] = useState(false);
  // Load-once guards for the heavy "fetch all" lists, which are now pulled on first
  // use rather than eagerly on login. 'idle' → not requested yet; reset on auth change.
  const flashcardsStatusRef = React.useRef<'idle' | 'loading' | 'loaded'>('idle');
  const videosStatusRef = React.useRef<'idle' | 'loading' | 'loaded'>('idle');
  const notesStatusRef = React.useRef<'idle' | 'loading' | 'loaded'>('idle');
  const documentsStatusRef = React.useRef<'idle' | 'loading' | 'loaded'>('idle');
  const quizSubmissionsStatusRef = React.useRef<'idle' | 'loading' | 'loaded'>('idle');
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [totalAudio, setTotalAudio] = useState(0);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [totalNotes, setTotalNotes] = useState(0);
  const [totalFlashcards, setTotalFlashcards] = useState(0);
  const [totalGlossaryTerms, setTotalGlossaryTerms] = useState(0);
  const [totalQuizQuestions, setTotalQuizQuestions] = useState(0);
  const [totalQuizSubmissions, setTotalQuizSubmissions] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [courseMaterialCounts, setCourseMaterialCounts] = useState<CourseMaterialStats[]>([]);
  const [achievementStats, setAchievementStats] = useState<ServerAchievementStats>(EMPTY_ACHIEVEMENT_STATS);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [progress, setProgress] = useState<LearningProgress[]>([]);
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([]);

  // Load courses and flashcards on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      invalidateVideoListCache();
      invalidateDocumentListCache();
      invalidateFlashcardListCache();
      invalidateDashboardSummaryCache();
      flashcardsStatusRef.current = 'idle';
      videosStatusRef.current = 'idle';
      notesStatusRef.current = 'idle';
      documentsStatusRef.current = 'idle';
      quizSubmissionsStatusRef.current = 'idle';
      setDocuments([]);
      setVideos([]);
      setVideosLoading(false);
      setTotalDocuments(0);
      setTotalArticles(0);
      setTotalAudio(0);
      setTotalMaterials(0);
      setTotalNotes(0);
      setTotalFlashcards(0);
      setTotalGlossaryTerms(0);
      setTotalQuizQuestions(0);
      setTotalQuizSubmissions(0);
      setTotalVideos(0);
      setCourseMaterialCounts([]);
      setAchievementStats(EMPTY_ACHIEVEMENT_STATS);
      setCurrentDocument(null);
      setAllNotes([]);
      setChatMessages([]);
      setCourses([]);
      setFlashcards([]);
      setProgress([]);
      setQuizSubmissions([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    // New session — let the lazy lists be (re)fetched on next use.
    flashcardsStatusRef.current = 'idle';
    videosStatusRef.current = 'idle';
    notesStatusRef.current = 'idle';
    documentsStatusRef.current = 'idle';
    quizSubmissionsStatusRef.current = 'idle';

    // Critical: counts (stats) + courses power the dashboard — the post-login
    // landing page — and give other pages the totals they use to decide their
    // own fetches. Both are small, so the first paint stays fast.
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [fetchedCourses, stats] = await Promise.all([
          courseService.getCourses().catch(() => [] as Course[]),
          statsService.getUserStats().catch(() => EMPTY_STATS),
        ]);
        if (cancelled) return;
        setCourses(fetchedCourses);
        setTotalDocuments(stats.totalDocuments);
        setTotalArticles(stats.totalArticles);
        setTotalAudio(stats.totalAudio);
        setTotalMaterials(stats.totalMaterials);
        setTotalNotes(stats.totalNotes);
        setTotalFlashcards(stats.totalFlashcards);
        setTotalGlossaryTerms(stats.totalGlossaryTerms);
        setTotalQuizQuestions(stats.totalQuizQuestions);
        setTotalQuizSubmissions(stats.totalQuizSubmissions);
        setTotalVideos(stats.totalVideos);
        setCourseMaterialCounts(stats.courseMaterialCounts);
        setAchievementStats(stats.achievements);
      } catch (error) {
        if (!cancelled) console.error('Failed to load initial data:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
      // The document list, quiz submissions, flashcards, the video list and notes
      // are NOT loaded here — they're pulled lazily by the pages that actually read
      // them (see ensureDocuments / ensureQuizSubmissions / ensureFlashcards /
      // ensureVideos / ensureNotes), keeping the post-login first paint fast.
    };

    loadInitialData();

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Load chat history when the current document changes. Keyed on the document
  // id (not the object) so re-setting the same document with fresh data — e.g.
  // after getDocument resolves or a summary/mind-map merge — doesn't refetch.
  const currentDocumentId = currentDocument?.id;
  const currentDocumentCourseId = currentDocument?.courseId;
  useEffect(() => {
    if (!currentDocumentId || !isAuthenticated) {
      setChatMessages([]);
      return;
    }

    const loadChatHistory = async () => {
      try {
        const history = await documentService.getChatHistory(
          currentDocumentCourseId || '',
          currentDocumentId
        );
        setChatMessages(history);
      } catch (error) {
        console.error('Failed to load chat history:', error);
        setChatMessages([]);
      }
    };

    loadChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDocumentId, isAuthenticated]);

  const refreshNotes = React.useCallback(async (): Promise<void> => {
    try {
      const result = await noteService.getAllNotes(1, 10);
      setAllNotes(result.items);
      notesStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh notes:', error);
    }
  }, []);

  // Lazy load-once for the recent-notes list — used by global search and the
  // settings export. Pulled the first time a reader mounts, not eagerly on login.
  const ensureNotes = React.useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (notesStatusRef.current !== 'idle') return;
    notesStatusRef.current = 'loading';
    try {
      const result = await noteService.getAllNotes(1, 10);
      setAllNotes(result.items);
      notesStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load notes:', error);
      notesStatusRef.current = 'idle';
    }
  }, [isAuthenticated, isLoading]);

  const refreshFlashcards = React.useCallback(async (): Promise<void> => {
    try {
      const result = await flashcardService.getAllFlashcards(1, fetchAllSize(totalFlashcards));
      setFlashcards(result.items);
      flashcardsStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh flashcards:', error);
    }
  }, [totalFlashcards]);

  // Lazy load-once for the full flashcard deck — fetched the first time a page that
  // renders it mounts, instead of eagerly on login. Waits for stats so it's sized
  // to the real deck size; resets to 'idle' on error so a later mount can retry.
  const ensureFlashcards = React.useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (flashcardsStatusRef.current !== 'idle') return;
    flashcardsStatusRef.current = 'loading';
    try {
      const result = await flashcardService.getAllFlashcards(1, fetchAllSize(totalFlashcards));
      if (result.items.length > 0) {
        setFlashcards(result.items);
        void offlineCacheService.cacheFlashcards(result.items);
      } else if (isOffline()) {
        // Offline with no fresh data — fall back to the last cached deck.
        setFlashcards(await offlineCacheService.getCachedFlashcards());
      } else {
        setFlashcards(result.items);
      }
      flashcardsStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load flashcards:', error);
      flashcardsStatusRef.current = 'idle';
    }
  }, [isAuthenticated, isLoading, totalFlashcards]);

  const refreshQuizSubmissions = React.useCallback(async (): Promise<void> => {
    try {
      const result = await quizSubmissionService.getAllSubmissions(1, 10);
      setQuizSubmissions(result.items);
      quizSubmissionsStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh quiz submissions:', error);
    }
  }, []);

  // Lazy load-once for the recent quiz submissions, used by the dashboard and the
  // settings export. Pulled the first time a reader mounts, not eagerly on login.
  const ensureQuizSubmissions = React.useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (quizSubmissionsStatusRef.current !== 'idle') return;
    quizSubmissionsStatusRef.current = 'loading';
    try {
      const result = await quizSubmissionService.getAllSubmissions(1, 10);
      setQuizSubmissions(result.items);
      quizSubmissionsStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load quiz submissions:', error);
      quizSubmissionsStatusRef.current = 'idle';
    }
  }, [isAuthenticated, isLoading]);

  // documentCount must cover every row /api/documents returns (plain docs +
  // articles + audio), not just totalDocuments — otherwise the fetch is sized too
  // small and truncates the list.
  const documentCount = totalDocuments + totalArticles + totalAudio;

  const refreshDocuments = React.useCallback(async (): Promise<void> => {
    try {
      const result = await documentService.getAllDocuments(1, fetchAllSize(documentCount));
      setDocuments(result.items);
      documentsStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh documents:', error);
    }
  }, [documentCount]);

  // Lazy load-once for the full document list — used by the dashboard, global
  // chrome (StudyCalendar, GlobalSearch) and the detail/summarizer pages. Fetched
  // the first time a page that reads it mounts, instead of eagerly on login.
  const ensureDocuments = React.useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (documentsStatusRef.current !== 'idle') return;
    documentsStatusRef.current = 'loading';
    try {
      const result = await documentService.getAllDocuments(1, fetchAllSize(documentCount));
      setDocuments(result.items);
      documentsStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load documents:', error);
      documentsStatusRef.current = 'idle';
    }
  }, [isAuthenticated, isLoading, documentCount]);

  const refreshVideos = React.useCallback(async (): Promise<void> => {
    if (totalVideos === 0) { setVideos([]); videosStatusRef.current = 'loaded'; return; }
    setVideosLoading(true);
    try {
      const result = await videoService.getVideosLite({ page: 1, pageSize: fetchAllSize(totalVideos) });
      setVideos(result.items);
      videosStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh videos:', error);
    } finally {
      setVideosLoading(false);
    }
  }, [totalVideos]);

  // Lazy load-once for the (lite) video list, used to label content sources. Pulled
  // the first time a page that reads it mounts, rather than eagerly on login.
  const ensureVideos = React.useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (videosStatusRef.current !== 'idle') return;
    videosStatusRef.current = 'loading';
    if (totalVideos === 0) { setVideos([]); videosStatusRef.current = 'loaded'; return; }
    setVideosLoading(true);
    try {
      const result = await videoService.getVideosLite({ page: 1, pageSize: fetchAllSize(totalVideos) });
      setVideos(result.items);
      videosStatusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load videos:', error);
      videosStatusRef.current = 'idle';
    } finally {
      setVideosLoading(false);
    }
  }, [isAuthenticated, isLoading, totalVideos]);

  const refreshStats = React.useCallback(async (): Promise<void> => {
    try {
      const stats = await statsService.getUserStats();
      setTotalDocuments(stats.totalDocuments);
      setTotalArticles(stats.totalArticles);
      setTotalAudio(stats.totalAudio);
      setTotalMaterials(stats.totalMaterials);
      setTotalNotes(stats.totalNotes);
      setTotalFlashcards(stats.totalFlashcards);
      setTotalGlossaryTerms(stats.totalGlossaryTerms);
      setTotalQuizQuestions(stats.totalQuizQuestions);
      setTotalQuizSubmissions(stats.totalQuizSubmissions);
      setTotalVideos(stats.totalVideos);
      setCourseMaterialCounts(stats.courseMaterialCounts);
      setAchievementStats(stats.achievements);
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  }, []);

  const deleteDocument = async (courseId: string, documentId: string): Promise<void> => {
    await documentService.deleteDocument(courseId, documentId);
    setDocuments(prev => prev.filter(d => d.id !== documentId));
    setTotalDocuments(prev => Math.max(0, prev - 1));
    if (currentDocument?.id === documentId) setCurrentDocument(null);
  };

  const deleteVideo = async (videoId: string): Promise<void> => {
    await videoService.deleteVideo(videoId);
    setVideos(prev => prev.filter(v => v.id !== videoId));
    setTotalVideos(prev => Math.max(0, prev - 1));
    setTotalMaterials(prev => Math.max(0, prev - 1));
    refreshStats();
  };

  const addDocument = async (file: File, courseId: string): Promise<string> => {
    const newDoc = await documentService.uploadDocument(courseId, file);
    setDocuments((prev) => [newDoc, ...prev]);
    setTotalDocuments(prev => prev + 1);

    const newProgress: LearningProgress = {
      documentId: newDoc.id,
      completionPercentage: 0,
      quizScores: [],
      timeSpent: 0,
      lastAccessed: new Date().toISOString(),
    };
    setProgress((prev) => [...prev, newProgress]);

    return newDoc.id;
  };

  const updateDocumentInList = (doc: Document) => {
    setDocuments(prev => prev.map(d => d.id === doc.id ? doc : d));
  };

  const addFlashcard = async (front: string, back: string): Promise<void> => {
    if (!currentDocument) return;
    const newCard = await flashcardService.createFlashcard({
      front,
      back,
      documentId: currentDocument.id,
    });
    setFlashcards((prev) => [...prev, { ...newCard, documentId: currentDocument.id }]);
  };

  const updateProgress = (docId: string, updates: Partial<LearningProgress>) => {
    setProgress((prev) => {
      const existing = prev.find((p) => p.documentId === docId);
      if (existing) {
        return prev.map((p) =>
          p.documentId === docId ? { ...p, ...updates, lastAccessed: new Date().toISOString() } : p
        );
      } else {
        return [
          ...prev,
          {
            documentId: docId,
            completionPercentage: 0,
            quizScores: [],
            timeSpent: 0,
            lastAccessed: new Date().toISOString(),
            ...updates,
          },
        ];
      }
    });
  };

  const addCourse = async (name: string, color: string): Promise<void> => {
    const newCourse = await courseService.createCourse({ courseName: name, courseColor: color });
    setCourses((prev) => [...prev, newCourse]);
  };

  const updateCourse = async (id: string, name: string, color: string): Promise<void> => {
    const updated = await courseService.updateCourse(id, { courseName: name, courseColor: color });
    setCourses((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const deleteCourse = async (id: string): Promise<void> => {
    await courseService.deleteCourse(id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const addNote = async (content: string): Promise<void> => {
    if (!currentDocument) return;
    const newNote = await documentService.createNote(
      currentDocument.courseId || '',
      currentDocument.id,
      content
    );
    setAllNotes((prev) => [newNote, ...prev]);
    setTotalNotes(prev => prev + 1);
  };

  const deleteNote = async (id: string): Promise<void> => {
    const note = allNotes.find((n) => n.id === id);
    if (!note) return;
    const doc = documents.find((d) => d.id === note.documentId);
    if (!doc) return;
    await documentService.deleteNote(doc.courseId || '', doc.id, id);
    setAllNotes((prev) => prev.filter((n) => n.id !== id));
    setTotalNotes(prev => Math.max(0, prev - 1));
  };

  const updateNote = async (id: string, content: string): Promise<void> => {
    const note = allNotes.find((n) => n.id === id);
    if (!note) return;
    const doc = documents.find((d) => d.id === note.documentId);
    if (!doc) return;
    const updated = await documentService.updateNote(doc.courseId || '', doc.id, id, content);
    setAllNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
  };

  const addChatMessage = async (role: 'user' | 'model', content: string): Promise<void> => {
    if (role === 'user') {
      // Optimistically add user message to state
      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, tempMessage]);

      // Call API and add model response
      if (currentDocument) {
        try {
          const reply = await documentService.chat(
            currentDocument.courseId || '',
            currentDocument.id,
            content
          );
          const modelMessage: ChatMessage = {
            id: `model-${Date.now()}`,
            role: 'model',
            content: reply,
            timestamp: new Date().toISOString(),
          };
          setChatMessages((prev) => [...prev, modelMessage]);
        } catch (error) {
          console.error('Chat error:', error);
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: 'model',
            content: error instanceof Error ? error.message : 'An unknown error occurred.',
            timestamp: new Date().toISOString(),
          };
          setChatMessages((prev) => [...prev, errorMessage]);
        }
      }
    } else {
      // For model messages added directly (e.g. error messages), just add to state
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role,
        content,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, newMessage]);
    }
  };

  const resetData = () => {
    invalidateVideoListCache();
    invalidateDocumentListCache();
    invalidateFlashcardListCache();
    invalidateDashboardSummaryCache();
    flashcardsStatusRef.current = 'idle';
    videosStatusRef.current = 'idle';
    notesStatusRef.current = 'idle';
    setDocuments([]);
    setVideos([]);
    setTotalDocuments(0);
    setTotalArticles(0);
    setTotalAudio(0);
    setTotalMaterials(0);
    setTotalNotes(0);
    setTotalFlashcards(0);
    setTotalGlossaryTerms(0);
    setTotalQuizQuestions(0);
    setTotalQuizSubmissions(0);
    setTotalVideos(0);
    setCourseMaterialCounts([]);
    setAchievementStats(EMPTY_ACHIEVEMENT_STATS);
    setAllNotes([]);
    setCourses([]);
    setFlashcards([]);
    setProgress([]);
    setChatMessages([]);
    setCurrentDocument(null);
  };

  return (
    <StudyContext.Provider
      value={{
        isLoading,
        documents,
        videos,
        videosLoading,
        totalDocuments,
        totalArticles,
        totalAudio,
        totalNotes,
        totalFlashcards,
        totalGlossaryTerms,
        totalQuizQuestions,
        totalQuizSubmissions,
        totalVideos,
        totalMaterials,
        courseMaterialCounts,
        achievementStats,
        currentDocument,
        setCurrentDocument,
        addDocument,
        deleteDocument,
        deleteVideo,
        updateDocumentInList,
        allNotes,
        addNote,
        updateNote,
        deleteNote,
        chatMessages,
        addChatMessage,
        aiInput,
        setAiInput,
        noteInput,
        setNoteInput,
        courses,
        addCourse,
        updateCourse,
        deleteCourse,
        flashcards,
        setFlashcards,
        addFlashcard,
        progress,
        updateProgress,
        quizSubmissions,
        refreshStats,
        refreshNotes,
        refreshFlashcards,
        refreshDocuments,
        refreshVideos,
        ensureDocuments,
        ensureFlashcards,
        ensureVideos,
        ensureNotes,
        ensureQuizSubmissions,
        refreshQuizSubmissions,
        resetData,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
};

export const useStudy = () => {
  const context = useContext(StudyContext);
  if (!context) throw new Error('useStudy must be used within StudyProvider');
  return context;
};
