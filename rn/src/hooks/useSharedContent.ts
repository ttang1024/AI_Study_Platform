import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { getShare, type SharedContent } from '@/services/shareService';
import { parseYouTubeId } from '@core/videoSources';
import { buildMindMapHtml } from '@/utils/mindMapHtml';
import { xmindMarkToMarkdown } from '@/utils/xmindMarkdown';
import Brain from 'lucide-react-native/icons/brain';
import FileText from 'lucide-react-native/icons/file-text';
import HelpCircle from 'lucide-react-native/icons/circle-question-mark';
import Layers from 'lucide-react-native/icons/layers';
import NotebookPen from 'lucide-react-native/icons/notebook-pen';
import SquareLibrary from 'lucide-react-native/icons/square-library';

export type SharedTab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'glossary' | 'quiz';

export interface ChatMessage { role: 'user' | 'model'; content: string }

/** Chat shares store the transcript as JSON inside notesHtml (see web SharedChatTranscript). */
const parseChatTranscript = (value: string): ChatMessage[] | null => {
  try {
    const parsed = JSON.parse(value) as { type?: string; messages?: { role?: string; content?: unknown }[] };
    if (parsed.type !== 'chat-transcript' || !Array.isArray(parsed.messages)) return null;
    const messages = parsed.messages
      .filter((m) => (m.role === 'user' || m.role === 'model') && typeof m.content === 'string')
      .map((m) => ({ role: m.role as 'user' | 'model', content: m.content as string }));
    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
};

export const SOURCE_BADGES: Record<string, string> = {
  chat: 'AI Chat',
  youtube: 'YouTube Video',
  bilibili: 'Bilibili Video',
  upload: 'Uploaded Video',
  audio: 'Audio',
  podcast: 'Podcast',
  article: 'Article',
  document: 'Document',
};

/** Fetch + derived state for a shared-content link: tabs, media source type, mind map HTML, chat parsing. */
export function useSharedContent() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [content, setContent] = useState<SharedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SharedTab | null>(null);

  useEffect(() => {
    if (!token) return;
    getShare(token)
      .then((data) => {
        setContent(data);
        if (data.summary) setTab('summary');
        else if (data.mindMapText) setTab('mindmap');
        else if (data.notesHtml) setTab('notes');
        else if (data.flashcards?.length) setTab('flashcards');
        else if (data.glossary?.length) setTab('glossary');
        else if (data.quizzes?.length) setTab('quiz');
      })
      .catch((e: { response?: { status?: number } }) => {
        setError(e?.response?.status === 410
          ? 'This share link has expired.'
          : 'This shared content could not be found or has expired.');
      });
  }, [token]);

  // No token is a synchronous, render-time condition — not an effect concern — so it's derived
  // here instead of being set as state from inside the effect.
  const effectiveError = !token ? 'Invalid share link.' : error;

  const mindMapHtml = content?.mindMapText ? buildMindMapHtml(xmindMarkToMarkdown(content.mindMapText)) : null;

  // Mirror web's normalization: legacy shares stored uploads/bilibili under "youtube".
  const sourceType = content
    ? (content.sourceType === 'youtube' && content.sourceUrl?.includes('bilibili.com')
      ? 'bilibili'
      : content.sourceType === 'youtube' && content.sourceUrl?.startsWith('video/')
        ? 'upload'
        : content.sourceType ?? null)
    : null;

  const tabs = content ? ([
    { id: 'summary' as SharedTab, label: 'Summary', icon: FileText, available: !!content.summary },
    { id: 'mindmap' as SharedTab, label: 'Mind Map', icon: Brain, available: !!content.mindMapText },
    { id: 'notes' as SharedTab, label: sourceType === 'chat' ? 'Conversation' : 'Notes', icon: NotebookPen, available: !!content.notesHtml },
    { id: 'flashcards' as SharedTab, label: 'Flashcards', icon: Layers, available: !!content.flashcards?.length },
    { id: 'glossary' as SharedTab, label: 'Glossary', icon: SquareLibrary, available: !!content.glossary?.length },
    { id: 'quiz' as SharedTab, label: 'Quiz', icon: HelpCircle, available: !!content.quizzes?.length },
  ]).filter((t) => t.available) : [];

  const createdAt = content ? new Date(content.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const youTubeId = sourceType === 'youtube' && content?.sourceUrl ? parseYouTubeId(content.sourceUrl) : null;
  const chatMessages = sourceType === 'chat' && content?.notesHtml ? parseChatTranscript(content.notesHtml) : null;

  return { content, error: effectiveError, tab, setTab, mindMapHtml, sourceType, tabs, createdAt, youTubeId, chatMessages };
}
