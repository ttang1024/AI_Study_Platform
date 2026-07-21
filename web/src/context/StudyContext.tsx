import React, { createContext, useContext, useState, useEffect } from 'react';
import { Document, Note, Course, Flashcard, LearningProgress } from '../types';
import { StudySessionProvider, useStudySession, StudySessionContextType } from './StudySessionContext';
import { courseService } from '../services/courseService';
import { QuizSubmission, invalidateDocumentListCache } from '../services/documentService';
import { VideoListItem, invalidateVideoListCache } from '../services/videoService';
import { invalidateFlashcardListCache } from '../services/flashcardService';
import { AchievementStats as ServerAchievementStats, CourseMaterialStats, statsService } from '../services/statsService';
import { invalidateDashboardSummaryCache } from '../services/analyticsService';
import { useAuth } from './AuthContext';
import { useStatsSlice, EMPTY_STATS } from './studyContext/useStatsSlice';
import { useCoursesSlice } from './studyContext/useCoursesSlice';
import { useDocumentsSlice } from './studyContext/useDocumentsSlice';
import { useVideosSlice } from './studyContext/useVideosSlice';
import { useFlashcardsSlice } from './studyContext/useFlashcardsSlice';
import { useNotesSlice } from './studyContext/useNotesSlice';
import { useQuizSubmissionsSlice } from './studyContext/useQuizSubmissionsSlice';

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

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);

  const stats = useStatsSlice();
  const courses = useCoursesSlice();
  const quizSubmissions = useQuizSubmissionsSlice({ isAuthenticated, isLoading });
  const documentsSlice = useDocumentsSlice({
    isAuthenticated, isLoading, documentCount: stats.documentCount, currentDocument, setCurrentDocument,
    onDocumentCountDelta: (delta) => stats.setTotalDocuments(prev => Math.max(0, prev + delta)),
  });
  const notes = useNotesSlice({
    isAuthenticated, isLoading, currentDocument,
    documents: documentsSlice.documents,
    onNoteCountDelta: (delta) => stats.setTotalNotes(prev => Math.max(0, prev + delta)),
  });
  const videos = useVideosSlice({
    isAuthenticated, isLoading, totalVideos: stats.totalVideos,
    setTotalVideos: stats.setTotalVideos, setTotalMaterials: stats.setTotalMaterials, refreshStats: stats.refreshStats,
  });
  const flashcards = useFlashcardsSlice({ isAuthenticated, isLoading, totalFlashcards: stats.totalFlashcards, currentDocument });

  // Load courses and flashcards on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      invalidateVideoListCache();
      invalidateDocumentListCache();
      invalidateFlashcardListCache();
      invalidateDashboardSummaryCache();
      flashcards.markIdle();
      videos.markIdle();
      notes.markIdle();
      documentsSlice.markIdle();
      quizSubmissions.markIdle();
      documentsSlice.setDocuments([]);
      videos.setVideos([]);
      videos.setVideosLoading(false);
      stats.resetStats();
      setCurrentDocument(null);
      notes.setAllNotes([]);
      courses.setCourses([]);
      flashcards.setFlashcards([]);
      quizSubmissions.setQuizSubmissions([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    // New session — let the lazy lists be (re)fetched on next use.
    flashcards.markIdle();
    videos.markIdle();
    notes.markIdle();
    documentsSlice.markIdle();
    quizSubmissions.markIdle();

    // Critical: counts (stats) + courses power the dashboard — the post-login
    // landing page — and give other pages the totals they use to decide their
    // own fetches. Both are small, so the first paint stays fast.
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [fetchedCourses, fetchedStats] = await Promise.all([
          courseService.getCourses().catch(() => [] as Course[]),
          statsService.getUserStats().catch(() => EMPTY_STATS),
        ]);
        if (cancelled) return;
        courses.setCourses(fetchedCourses);
        stats.applyStats(fetchedStats);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const resetData = () => {
    invalidateVideoListCache();
    invalidateDocumentListCache();
    invalidateFlashcardListCache();
    invalidateDashboardSummaryCache();
    flashcards.markIdle();
    videos.markIdle();
    notes.markIdle();
    documentsSlice.setDocuments([]);
    videos.setVideos([]);
    stats.resetStats();
    notes.setAllNotes([]);
    courses.setCourses([]);
    flashcards.setFlashcards([]);
    // Chat scrollback lives in StudySessionContext and clears itself when
    // currentDocument resets to null below.
    setCurrentDocument(null);
  };

  return (
    <StudyContext.Provider
      value={{
        isLoading,
        documents: documentsSlice.documents,
        videos: videos.videos,
        videosLoading: videos.videosLoading,
        totalDocuments: stats.totalDocuments,
        totalArticles: stats.totalArticles,
        totalAudio: stats.totalAudio,
        totalNotes: stats.totalNotes,
        totalFlashcards: stats.totalFlashcards,
        totalGlossaryTerms: stats.totalGlossaryTerms,
        totalQuizQuestions: stats.totalQuizQuestions,
        totalQuizSubmissions: stats.totalQuizSubmissions,
        totalVideos: stats.totalVideos,
        totalMaterials: stats.totalMaterials,
        courseMaterialCounts: stats.courseMaterialCounts,
        achievementStats: stats.achievementStats,
        currentDocument,
        setCurrentDocument,
        addDocument: documentsSlice.addDocument,
        deleteDocument: documentsSlice.deleteDocument,
        deleteVideo: videos.deleteVideo,
        updateDocumentInList: documentsSlice.updateDocumentInList,
        allNotes: notes.allNotes,
        addNote: notes.addNote,
        updateNote: notes.updateNote,
        deleteNote: notes.deleteNote,
        courses: courses.courses,
        addCourse: courses.addCourse,
        updateCourse: courses.updateCourse,
        deleteCourse: courses.deleteCourse,
        flashcards: flashcards.flashcards,
        setFlashcards: flashcards.setFlashcards,
        addFlashcard: flashcards.addFlashcard,
        progress: documentsSlice.progress,
        updateProgress: documentsSlice.updateProgress,
        quizSubmissions: quizSubmissions.quizSubmissions,
        refreshStats: stats.refreshStats,
        refreshNotes: notes.refreshNotes,
        refreshFlashcards: flashcards.refreshFlashcards,
        refreshDocuments: documentsSlice.refreshDocuments,
        refreshVideos: videos.refreshVideos,
        ensureDocuments: documentsSlice.ensureDocuments,
        ensureFlashcards: flashcards.ensureFlashcards,
        ensureVideos: videos.ensureVideos,
        ensureNotes: notes.ensureNotes,
        ensureQuizSubmissions: quizSubmissions.ensureQuizSubmissions,
        refreshQuizSubmissions: quizSubmissions.refreshQuizSubmissions,
        resetData,
      }}
    >
      <StudySessionProvider currentDocument={currentDocument}>
        {children}
      </StudySessionProvider>
    </StudyContext.Provider>
  );
};

/**
 * Backward-compatible hook exposing the core study state merged with the
 * session slice. Components that only touch chat/composer state should use
 * useStudySession() instead so unrelated updates don't re-render them —
 * and vice versa, hot paths that write session state every keystroke no
 * longer re-render consumers of the core context.
 */
export const useStudy = (): StudyContextType & StudySessionContextType => {
  const context = useContext(StudyContext);
  const session = useStudySession();
  if (!context) throw new Error('useStudy must be used within StudyProvider');
  return { ...context, ...session };
};

export { useStudySession };
