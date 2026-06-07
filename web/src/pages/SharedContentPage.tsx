import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Share2, AlertCircle, FileText, MessageCircle, Award,
  Check, Copy, User, Calendar, Youtube, Mic, Rss, FileVideo,
} from 'lucide-react';
import { STUDY_TYPE_ICONS } from '../constants/contentTypeIcons';
import { getShare, SharedContent } from '../services/shareContentService';
import { cn } from '../utils/cn';
import { getApiUrl } from '../utils/env';
import { SummaryMarkdown } from '../components/study/SummaryMarkdown';
import { FlashcardSessionDeck } from '../components/study/FlashcardSessionCard';
import { MarkmapView } from './sharedContent/MarkmapView';
import { SharedChatTranscript } from './sharedContent/SharedChatTranscript';
import { SharedQuiz } from './sharedContent/SharedQuiz';
import { SharedGlossary } from './sharedContent/SharedGlossary';
import { SharedMedia, NormalizedSourceType } from './sharedContent/SharedMedia';

const API_URL = getApiUrl();

type Tab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'glossary';

const getTokenFromPath = () => {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.match(/\/share\/([^/?#]+)/)?.[1] ?? '';
};

export const SharedContentPage: React.FC<{ token?: string }> = ({ token: tokenProp }) => {
  const token = tokenProp ?? getTokenFromPath();
  const [content, setContent] = useState<SharedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [copied, setCopied] = useState(false);
  const [articleHtml, setArticleHtml] = useState<string | null>(null);
  const [articleCollapsed, setArticleCollapsed] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid share link.'); setLoading(false); return; }
    getShare(token)
      .then(data => {
        setContent(data);
        // Auto-select first available tab
        if (data.summary) setActiveTab('summary');
        else if (data.mindMapText) setActiveTab('mindmap');
        else if (data.notesHtml) setActiveTab('notes');
        else if (data.flashcards?.length) setActiveTab('flashcards');
        else if (data.glossary?.length) setActiveTab('glossary');
        else if (data.quizzes?.length) setActiveTab('quiz');
        if (data.sourceType === 'article' && data.sourceUrl) {
          fetch(`${API_URL}/api/share/${token}/article`)
            .then(r => r.ok ? r.text() : null)
            .then(html => { if (html) setArticleHtml(html); })
            .catch(() => { });
        }
      })
      .catch((err: any) => {
        if (err?.response?.status === 410) setError('This share link has expired.');
        else setError('This shared content could not be found or has expired.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="text-center space-y-4 max-w-sm mx-auto px-4">
          <div className="rounded-2xl bg-red-50 p-5 text-red-500 w-fit mx-auto"><AlertCircle size={32} /></div>
          <h1 className="text-xl font-bold text-text-main">Content Not Found</h1>
          <p className="text-text-muted">{error}</p>
          <a href="/" className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
            Go to Study Platform
          </a>
        </div>
      </div>
    );
  }

  const allTabs = [
    { id: 'summary' as Tab, label: 'Summary', icon: STUDY_TYPE_ICONS.summary.icon, available: !!content.summary },
    { id: 'mindmap' as Tab, label: 'Mind Map', icon: STUDY_TYPE_ICONS.mindmap.icon, available: !!content.mindMapText },
    { id: 'notes' as Tab, label: content.sourceType === 'chat' ? 'Conversation' : 'Notes', icon: STUDY_TYPE_ICONS.notes.icon, available: !!content.notesHtml },
    { id: 'flashcards' as Tab, label: 'Flashcards', icon: STUDY_TYPE_ICONS.flashcard.icon, available: !!(content.flashcards?.length) },
    { id: 'glossary' as Tab, label: 'Glossary', icon: STUDY_TYPE_ICONS.glossary.icon, available: !!(content.glossary?.length) },
    { id: 'quiz' as Tab, label: 'Quiz', icon: STUDY_TYPE_ICONS.quiz.icon, available: !!(content.quizzes?.length) },
  ];
  const tabs = allTabs.filter(t => t.available);

  const createdAt = new Date(content.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const normalizedSourceType = (content.sourceType === 'youtube' && content.sourceUrl?.includes('bilibili.com')
    ? 'bilibili'
    : content.sourceType === 'youtube' && content.sourceUrl?.startsWith('video/')
      ? 'upload'
      : content.sourceType) as NormalizedSourceType;

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <Share2 size={11} /> {content.sourceType === 'chat' ? 'Shared Conversation' : 'Shared Study Content'}
                </div>
                {content.sourceType === 'chat' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary border border-primary/10">
                    <MessageCircle size={11} /> AI Chat
                  </div>
                )}
                {normalizedSourceType === 'youtube' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-500 border border-red-100">
                    <Youtube size={11} /> YouTube Video
                  </div>
                )}
                {normalizedSourceType === 'bilibili' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600 border border-sky-100">
                    <img src="/images/bilibili.png" alt="" className="h-3 w-3 object-contain" /> Bilibili Video
                  </div>
                )}
                {normalizedSourceType === 'upload' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary border border-primary/10">
                    <FileVideo size={11} /> Uploaded Video
                  </div>
                )}
                {normalizedSourceType === 'audio' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-100">
                    <Mic size={11} /> Audio
                  </div>
                )}
                {normalizedSourceType === 'podcast' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-100">
                    <Rss size={11} /> Podcast
                  </div>
                )}
                {normalizedSourceType === 'article' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-600 border border-teal-100">
                    <FileText size={11} /> Article
                  </div>
                )}
                {normalizedSourceType === 'document' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500 border border-zinc-200">
                    <FileText size={11} /> Document
                  </div>
                )}
              </div>
              <h1 className="text-xl font-black text-text-main leading-tight">{content.title}</h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  <User size={12} /> {content.ownerName}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Calendar size={12} /> {createdAt}
                </span>
                {content.expiresAt && (
                  <span className="text-xs text-amber-500 font-medium">
                    Expires {new Date(content.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold border transition-all shrink-0',
                copied ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-[var(--border-color)] text-text-muted hover:border-primary/50',
              )}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Media */}
        <SharedMedia
          content={content}
          normalizedSourceType={normalizedSourceType}
          articleHtml={articleHtml}
          articleCollapsed={articleCollapsed}
          onToggleArticle={() => setArticleCollapsed(c => !c)}
        />

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold whitespace-nowrap transition-all border',
                  activeTab === id
                    ? 'bg-primary text-white border-primary'
                    : 'border-[var(--border-color)] text-text-muted hover:border-primary/50 hover:text-text-main',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab ?? 'empty'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {activeTab === 'summary' && content.summary && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">Summary</h2>
                <div className="summary-content select-text px-0 py-0">
                  <SummaryMarkdown value={content.summary} />
                </div>
              </div>
            )}

            {activeTab === 'mindmap' && content.mindMapText && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4 px-2">Mind Map</h2>
                <MarkmapView text={content.mindMapText} />
              </div>
            )}

            {activeTab === 'notes' && content.notesHtml && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">
                  {content.sourceType === 'chat' ? 'Conversation' : 'Notes'}
                </h2>
                {content.sourceType === 'chat' ? (
                  <SharedChatTranscript value={content.notesHtml} />
                ) : (
                  <div
                    className="prose prose-sm max-w-none text-text-main"
                    dangerouslySetInnerHTML={{ __html: content.notesHtml }}
                  />
                )}
              </div>
            )}

            {activeTab === 'flashcards' && content.flashcards && content.flashcards.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">Flashcards</h2>
                <FlashcardSessionDeck
                  cards={content.flashcards.map((card, index) => ({
                    id: `shared-${index}`,
                    front: card.front,
                    back: card.back,
                    cardType: card.cardType,
                  }))}
                  title={content.title}
                  variant="inline"
                />
              </div>
            )}

            {activeTab === 'glossary' && content.glossary && content.glossary.length > 0 && (
              <SharedGlossary terms={content.glossary} />
            )}

            {activeTab === 'quiz' && content.quizzes && content.quizzes.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">Quiz</h2>
                <SharedQuiz questions={content.quizzes} title={content.title} />
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6 text-center">
          <Award size={22} className="mx-auto text-primary mb-3" />
          <p className="font-bold text-text-main mb-1">Want to create your own study materials?</p>
          <p className="text-sm text-text-muted mb-4">Upload documents or YouTube videos and get AI-generated summaries, mind maps, quizzes and flashcards.</p>
          <a href="/" className="inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity">
            Try Easy Study →
          </a>
        </div>

      </div>
    </div>
  );
};
