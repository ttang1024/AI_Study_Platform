import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ChatMessage, Document } from '../types';
import { documentService } from '../services/documentService';
import { useAuth } from './AuthContext';

/**
 * High-frequency per-session state (chat scrollback, chat/note composer inputs),
 * split out of StudyContext so keystrokes and streaming tokens only re-render
 * components that actually read them. Narrow consumers should prefer
 * useStudySession(); useStudy() still exposes these fields for compatibility.
 */
export interface StudySessionContextType {
  chatMessages: ChatMessage[];
  addChatMessage: (role: 'user' | 'model', content: string) => Promise<void>;
  aiInput: string;
  setAiInput: React.Dispatch<React.SetStateAction<string>>;
  noteInput: string;
  setNoteInput: React.Dispatch<React.SetStateAction<string>>;
}

const StudySessionContext = createContext<StudySessionContextType | undefined>(undefined);

export const StudySessionProvider: React.FC<{
  currentDocument: Document | null;
  children: React.ReactNode;
}> = ({ currentDocument, children }) => {
  const { isAuthenticated } = useAuth();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

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

  const addChatMessage = React.useCallback(async (role: 'user' | 'model', content: string): Promise<void> => {
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
  }, [currentDocument]);

  // Memoized so parent (StudyProvider) re-renders don't cascade to session
  // consumers unless session state itself changed.
  const value = useMemo(() => ({
    chatMessages, addChatMessage, aiInput, setAiInput, noteInput, setNoteInput,
  }), [chatMessages, addChatMessage, aiInput, noteInput]);

  return (
    <StudySessionContext.Provider value={value}>
      {children}
    </StudySessionContext.Provider>
  );
};

export const useStudySession = () => {
  const context = useContext(StudySessionContext);
  if (!context) throw new Error('useStudySession must be used within StudyProvider');
  return context;
};
