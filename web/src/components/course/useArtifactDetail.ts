import { useCallback, useEffect, useRef, useState } from 'react';
import { Course } from '../../types';
import { videoService } from '../../services/videoService';
import { documentService } from '../../services/documentService';
import { aiService } from '../../services/aiService';
import { getApiErrorCode } from '../../utils/apiError';
import { ArtifactDetail, ExternalMsg } from './artifactsWorkspaceModel';

/**
 * State that lives only while the detail modal is open: which item is shown,
 * the answer-reveal toggle, and the mind-map / chat streaming machinery.
 */
export function useArtifactDetail(course: Course | null) {
  const [detail, setDetail] = useState<ArtifactDetail>(null);

  // Answer reveal toggle — reset whenever the detail changes
  const [revealAnswers, setRevealAnswers] = useState(false);

  // Mind map state (tied to the open detail modal)
  const [mmText, setMmText] = useState<string | null>(null);
  const [mmGenerating, setMmGenerating] = useState(false);
  const [mmStreaming, setMmStreaming] = useState<string | null>(null);
  const [mmError, setMmError] = useState<string | null>(null);

  // Chat state (tied to the open detail modal)
  const [chatMessages, setChatMessages] = useState<ExternalMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatDetailKeyRef = useRef('');

  // Initialize mind map state when a mindmap detail opens
  useEffect(() => {
    if (!detail || detail.type !== 'mindmap') return;
    setMmError(null);
    setMmStreaming(null);
    setMmGenerating(false);
    setMmText(detail.initialMindMapText);
  }, [detail?.type === 'mindmap' ? detail.itemKey : null]);

  // Load chat history when a chat detail opens
  useEffect(() => {
    if (!detail || detail.type !== 'chat') return;
    if (chatDetailKeyRef.current === detail.itemKey) return;
    chatDetailKeyRef.current = detail.itemKey;
    setChatMessages([]);
    setChatLoading(true);
    if (detail.sourceKind === 'doc' && detail.documentId && course) {
      documentService.getChatHistory(course.id, detail.documentId)
        .then(msgs => setChatMessages(msgs.map(m => ({ id: m.id, role: m.role, content: m.content }))))
        .catch(() => { })
        .finally(() => setChatLoading(false));
    } else if (detail.sourceKind === 'video' && detail.videoId) {
      videoService.getChatHistory(detail.videoId)
        .then(msgs => setChatMessages(msgs))
        .catch(() => { })
        .finally(() => setChatLoading(false));
    } else {
      setChatLoading(false);
    }
  }, [detail?.type === 'chat' ? detail.itemKey : null, course]);

  // Reset chat key when modal closes
  useEffect(() => {
    if (!detail) chatDetailKeyRef.current = '';
  }, [detail]);

  // Reset answer reveal whenever the open detail item changes
  useEffect(() => {
    setRevealAnswers(false);
  }, [detail?.itemKey]);

  const handleGenerateMindMap = useCallback(async () => {
    if (!detail || detail.type !== 'mindmap' || !course || mmGenerating) return;
    setMmGenerating(true);
    setMmError(null);
    setMmText(null);
    setMmStreaming('');
    const accum = { current: '' };
    try {
      if (detail.sourceKind === 'doc' && detail.documentId) {
        await documentService.streamMindMap(course.id, detail.documentId, (chunk) => {
          accum.current += chunk;
          setMmStreaming(accum.current);
        });
      } else if (detail.sourceKind === 'video' && detail.videoUrl) {
        await aiService.streamMindMapFromYouTube(detail.videoUrl, (chunk) => {
          accum.current += chunk;
          setMmStreaming(accum.current);
        });
      }
      setMmText(accum.current || null);
    } catch (err) {
      setMmError(getApiErrorCode(err));
    } finally {
      setMmGenerating(false);
      setMmStreaming(null);
    }
  }, [detail, course, mmGenerating]);

  const handleChatStreamSend = useCallback(async (message: string, onChunk: (chunk: string) => void) => {
    if (!detail || detail.type !== 'chat' || !course) throw new Error('No material selected.');
    setChatMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: message }]);
    let accumulated = '';
    try {
      if (detail.sourceKind === 'doc' && detail.documentId) {
        await documentService.streamChat(course.id, detail.documentId, message, (chunk) => {
          accumulated += chunk;
          onChunk(chunk);
        });
      } else if (detail.sourceKind === 'video' && detail.videoId) {
        await videoService.streamChat(detail.videoId, message, (chunk) => {
          accumulated += chunk;
          onChunk(chunk);
        });
      }
      if (accumulated) {
        setChatMessages(prev => [...prev, { id: `m-${Date.now()}`, role: 'model', content: accumulated }]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to get a response.';
      setChatMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'model', content: errMsg, isError: true }]);
      throw err;
    }
  }, [detail, course]);

  return {
    detail,
    setDetail,
    revealAnswers,
    toggleRevealAnswers: () => setRevealAnswers(prev => !prev),
    mmText,
    mmGenerating,
    mmStreaming,
    mmError,
    chatMessages,
    chatLoading,
    handleGenerateMindMap,
    handleChatStreamSend,
  };
}
