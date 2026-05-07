import React, { createContext, useContext, useState, useEffect } from 'react';
import { Document, Note, ChatMessage, Course, Flashcard, LearningProgress } from '../types';
import { courseService } from '../services/courseService';
import { documentService, quizSubmissionService, QuizSubmission } from '../services/documentService';
import { VideoListItem } from '../services/youtubeService';
import { noteService } from '../services/noteService';
import { flashcardService } from '../services/flashcardService';
import { AchievementStats as ServerAchievementStats, CourseMaterialStats, statsService } from '../services/statsService';
import { useAuth } from './AuthContext';

interface StudyContextType {
  isLoading: boolean;
  documents: Document[];
  videos: VideoListItem[];
  totalDocuments: number;
  totalArticles: number;
  totalAudio: number;
  totalNotes: number;
  totalFlashcards: number;
  totalGlossaryTerms: number;
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
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [totalAudio, setTotalAudio] = useState(0);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [totalNotes, setTotalNotes] = useState(0);
  const [totalFlashcards, setTotalFlashcards] = useState(0);
  const [totalGlossaryTerms, setTotalGlossaryTerms] = useState(0);
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
      setDocuments([]);
      setTotalDocuments(0);
      setTotalArticles(0);
      setTotalAudio(0);
      setTotalMaterials(0);
      setTotalNotes(0);
      setTotalFlashcards(0);
      setTotalGlossaryTerms(0);
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

    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [fetchedCourses, fetchedFlashcards, fetchedSubmissions, stats, docsResult, fetchedNotes] = await Promise.all([
          courseService.getCourses().catch(() => [] as Course[]),
          flashcardService.getAllFlashcards(1, 500).catch(() => ({ items: [] as Flashcard[], totalCount: 0, page: 1, pageSize: 500, totalPages: 0 })),
          quizSubmissionService.getAllSubmissions(1, 10).catch(() => ({ items: [] as QuizSubmission[], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })),
          statsService.getUserStats().catch(() => EMPTY_STATS),
          documentService.getAllDocuments(1, 500).catch(() => ({ items: [] as Document[], totalCount: 0, page: 1, pageSize: 500, totalPages: 0 })),
          noteService.getAllNotes(1, 10).catch(() => ({ items: [] as Note[], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })),
        ]);
        setCourses(fetchedCourses);
        setFlashcards(fetchedFlashcards.items);
        setQuizSubmissions(fetchedSubmissions.items);
        setTotalDocuments(stats.totalDocuments);
        setTotalArticles(stats.totalArticles);
        setTotalAudio(stats.totalAudio);
        setTotalMaterials(stats.totalMaterials);
        setTotalNotes(stats.totalNotes);
        setTotalFlashcards(stats.totalFlashcards);
        setTotalGlossaryTerms(stats.totalGlossaryTerms);
        setTotalQuizSubmissions(stats.totalQuizSubmissions);
        setTotalVideos(stats.totalVideos);
        setCourseMaterialCounts(stats.courseMaterialCounts);
        setAchievementStats(stats.achievements);
        setDocuments(docsResult.items);
        setAllNotes(fetchedNotes.items);
        setVideos([]);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
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
      const result = await flashcardService.getAllFlashcards(1, 500);
      setFlashcards(result.items);
    } catch (error) {
      console.error('Failed to refresh flashcards:', error);
    }
  }, []);

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
      const result = await documentService.getAllDocuments(1, 500);
      setDocuments(result.items);
    } catch (error) {
      console.error('Failed to refresh documents:', error);
    }
  }, []);

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
    setDocuments([]);
    setVideos([]);
    setTotalDocuments(0);
    setTotalArticles(0);
    setTotalAudio(0);
    setTotalMaterials(0);
    setTotalNotes(0);
    setTotalFlashcards(0);
    setTotalGlossaryTerms(0);
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
        totalDocuments,
        totalArticles,
        totalAudio,
        totalNotes,
        totalFlashcards,
        totalGlossaryTerms,
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
