import React, { createContext, useContext, useState, useEffect } from 'react';
import { Document, Note, ChatMessage, Course, Flashcard, LearningProgress } from '../types';
import { courseService } from '../services/courseService';
import { documentService, quizSubmissionService, QuizSubmission, invalidateDocumentListCache } from '../services/documentService';
import { VideoListItem, invalidateVideoListCache, videoService } from '../services/videoService';
import { noteService } from '../services/noteService';
import { flashcardService, invalidateFlashcardListCache } from '../services/flashcardService';
import { AchievementStats as ServerAchievementStats, CourseMaterialStats, statsService } from '../services/statsService';
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
  updateDocumentInList: (doc: Document) => void;
  notes: Note[];
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
  const [videosLoading, setVideosLoading] = useState(true);
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
  const [notes, setNotes] = useState<Note[]>([]);
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
      setNotes([]);
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

    // Heavy / secondary lists. Fetched in the background after the first paint so
    // the initial render isn't blocked on them. The Library and Flashcards pages
    // also (re)load these on mount, and other readers (search, notes) populate as
    // they resolve — so deferring them is safe.
    const emptyVideos = { items: [] as VideoListItem[], totalCount: 0, page: 1, pageSize: 1, totalPages: 0 };
    const loadDeferredData = async (flashcardCount: number, documentCount: number, videoCount: number) => {
      const flashcardSize = fetchAllSize(flashcardCount);
      const documentSize = fetchAllSize(documentCount);
      setVideosLoading(true);
      const [fetchedFlashcards, docsResult, fetchedSubmissions, fetchedNotes, fetchedVideos] = await Promise.all([
        flashcardService.getAllFlashcards(1, flashcardSize).catch(() => ({ items: [] as Flashcard[], totalCount: 0, page: 1, pageSize: flashcardSize, totalPages: 0 })),
        documentService.getAllDocuments(1, documentSize).catch(() => ({ items: [] as Document[], totalCount: 0, page: 1, pageSize: documentSize, totalPages: 0 })),
        quizSubmissionService.getAllSubmissions(1, 10).catch(() => ({ items: [] as QuizSubmission[], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })),
        noteService.getAllNotes(1, 10).catch(() => ({ items: [] as Note[], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })),
        // Only fetch the (lite) video list when the user actually has videos; it's
        // used solely to label glossary/flashcard/note sources.
        videoCount > 0
          ? videoService.getVideosLite({ page: 1, pageSize: fetchAllSize(videoCount) }).catch(() => emptyVideos)
          : Promise.resolve(emptyVideos),
      ]);
      if (cancelled) return;

      if (fetchedFlashcards.items.length > 0) {
        setFlashcards(fetchedFlashcards.items);
        void offlineCacheService.cacheFlashcards(fetchedFlashcards.items);
      } else if (isOffline()) {
        // Offline with no fresh data — fall back to the last cached deck.
        const cached = await offlineCacheService.getCachedFlashcards();
        if (!cancelled) setFlashcards(cached);
      } else {
        setFlashcards(fetchedFlashcards.items);
      }
      setDocuments(docsResult.items);
      setQuizSubmissions(fetchedSubmissions.items);
      setAllNotes(fetchedNotes.items);
      setVideos(fetchedVideos.items);
      setVideosLoading(false);
    };

    // Critical: counts (stats) + courses power the dashboard — the post-login
    // landing page — and give other pages the totals they use to decide their
    // own fetches. Both are small, so the first paint stays fast.
    const loadInitialData = async () => {
      setIsLoading(true);
      let flashcardCount = 0;
      let documentCount = 0;
      let videoCount = 0;
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
        flashcardCount = stats.totalFlashcards;
        documentCount = stats.totalDocuments;
        videoCount = stats.totalVideos;
      } catch (error) {
        if (!cancelled) console.error('Failed to load initial data:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }

      // Kick off the heavy lists in the background once the critical data is in.
      // Pass the freshly-fetched stats counts directly — the setTotal* state
      // setters above won't be visible in this closure yet.
      if (!cancelled) void loadDeferredData(flashcardCount, documentCount, videoCount);
    };

    loadInitialData();

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Load notes when currentDocument changes
  useEffect(() => {
    if (!currentDocument || !isAuthenticated) {
      setNotes([]);
      return;
    }

    const loadNotes = async () => {
      try {
        const fetchedNotes = await documentService.getNotes(
          currentDocument.courseId || '',
          currentDocument.id
        );
        setNotes(fetchedNotes);
      } catch (error) {
        console.error('Failed to load notes:', error);
        setNotes([]);
      }
    };

    loadNotes();
  }, [currentDocument, isAuthenticated]);

  // Load chat history when currentDocument changes
  useEffect(() => {
    if (!currentDocument || !isAuthenticated) {
      setChatMessages([]);
      return;
    }

    const loadChatHistory = async () => {
      try {
        const history = await documentService.getChatHistory(
          currentDocument.courseId || '',
          currentDocument.id
        );
        setChatMessages(history);
      } catch (error) {
        console.error('Failed to load chat history:', error);
        setChatMessages([]);
      }
    };

    loadChatHistory();
  }, [currentDocument, isAuthenticated]);

  const refreshNotes = React.useCallback(async (): Promise<void> => {
    try {
      const result = await noteService.getAllNotes(1, 10);
      setAllNotes(result.items);
    } catch (error) {
      console.error('Failed to refresh notes:', error);
    }
  }, []);

  const refreshFlashcards = React.useCallback(async (): Promise<void> => {
    try {
      const result = await flashcardService.getAllFlashcards(1, fetchAllSize(totalFlashcards));
      setFlashcards(result.items);
    } catch (error) {
      console.error('Failed to refresh flashcards:', error);
    }
  }, [totalFlashcards]);

  const refreshQuizSubmissions = React.useCallback(async (): Promise<void> => {
    try {
      const result = await quizSubmissionService.getAllSubmissions(1, 10);
      setQuizSubmissions(result.items);
    } catch (error) {
      console.error('Failed to refresh quiz submissions:', error);
    }
  }, []);

  const refreshDocuments = React.useCallback(async (): Promise<void> => {
    try {
      const result = await documentService.getAllDocuments(1, fetchAllSize(totalDocuments));
      setDocuments(result.items);
    } catch (error) {
      console.error('Failed to refresh documents:', error);
    }
  }, [totalDocuments]);

  const refreshVideos = React.useCallback(async (): Promise<void> => {
    if (totalVideos === 0) { setVideos([]); return; }
    setVideosLoading(true);
    try {
      const result = await videoService.getVideosLite({ page: 1, pageSize: fetchAllSize(totalVideos) });
      setVideos(result.items);
    } catch (error) {
      console.error('Failed to refresh videos:', error);
    } finally {
      setVideosLoading(false);
    }
  }, [totalVideos]);

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
    setNotes((prev) => [newNote, ...prev]);
    setAllNotes((prev) => [newNote, ...prev]);
    setTotalNotes(prev => prev + 1);
  };

  const deleteNote = async (id: string): Promise<void> => {
    const note = notes.find((n) => n.id === id) || allNotes.find((n) => n.id === id);
    if (!note) return;
    const doc = documents.find((d) => d.id === note.documentId);
    if (!doc) return;
    await documentService.deleteNote(doc.courseId || '', doc.id, id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setAllNotes((prev) => prev.filter((n) => n.id !== id));
    setTotalNotes(prev => Math.max(0, prev - 1));
  };

  const updateNote = async (id: string, content: string): Promise<void> => {
    const note = notes.find((n) => n.id === id) || allNotes.find((n) => n.id === id);
    if (!note) return;
    const doc = documents.find((d) => d.id === note.documentId);
    if (!doc) return;
    const updated = await documentService.updateNote(doc.courseId || '', doc.id, id, content);
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
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
    setNotes([]);
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
        updateDocumentInList,
        notes,
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
