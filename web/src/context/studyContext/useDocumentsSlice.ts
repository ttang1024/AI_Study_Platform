import { useCallback, useRef, useState } from 'react';
import { Document, LearningProgress } from '../../types';
import { documentService } from '../../services/documentService';
import { fetchAllSize } from './helpers';

interface UseDocumentsSliceArgs {
  isAuthenticated: boolean;
  isLoading: boolean;
  documentCount: number;
  currentDocument: Document | null;
  setCurrentDocument: (doc: Document | null) => void;
  onDocumentCountDelta: (delta: number) => void;
}

/** The full document list (lazy load-once), CRUD, and per-document study progress. */
export function useDocumentsSlice({
  isAuthenticated, isLoading, documentCount, currentDocument, setCurrentDocument, onDocumentCountDelta,
}: UseDocumentsSliceArgs) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [progress, setProgress] = useState<LearningProgress[]>([]);
  const statusRef = useRef<'idle' | 'loading' | 'loaded'>('idle');

  const refreshDocuments = useCallback(async (): Promise<void> => {
    try {
      const result = await documentService.getAllDocuments(1, fetchAllSize(documentCount));
      setDocuments(result.items);
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh documents:', error);
    }
  }, [documentCount]);

  // Lazy load-once for the full document list — used by the dashboard, global chrome
  // (StudyCalendar, GlobalSearch) and the detail/summarizer pages. Fetched the first time a page
  // that reads it mounts, instead of eagerly on login.
  const ensureDocuments = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (statusRef.current !== 'idle') return;
    statusRef.current = 'loading';
    try {
      const result = await documentService.getAllDocuments(1, fetchAllSize(documentCount));
      setDocuments(result.items);
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load documents:', error);
      statusRef.current = 'idle';
    }
  }, [isAuthenticated, isLoading, documentCount]);

  const deleteDocument = async (courseId: string, documentId: string): Promise<void> => {
    await documentService.deleteDocument(courseId, documentId);
    setDocuments(prev => prev.filter(d => d.id !== documentId));
    onDocumentCountDelta(-1);
    if (currentDocument?.id === documentId) setCurrentDocument(null);
  };

  const addDocument = async (file: File, courseId: string): Promise<string> => {
    const newDoc = await documentService.uploadDocument(courseId, file);
    setDocuments((prev) => [newDoc, ...prev]);
    onDocumentCountDelta(1);

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

  const markIdle = useCallback(() => { statusRef.current = 'idle'; }, []);

  return {
    documents, setDocuments, refreshDocuments, ensureDocuments,
    deleteDocument, addDocument, updateDocumentInList,
    progress, updateProgress,
    markIdle,
  };
}
