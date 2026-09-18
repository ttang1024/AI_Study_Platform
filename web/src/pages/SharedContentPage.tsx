import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Share2, AlertCircle, MessageCircle, Sparkles,
  User, Calendar, Clock, Github, ArrowRight,
} from 'lucide-react';
import { STUDY_TYPE_ICONS, StudyTypeIconConfig } from '../constants/contentTypeIcons';
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
import { ShareTopBar, GITHUB_REPO_URL } from './sharedContent/ShareTopBar';
import { SourceBadge } from './sharedContent/SourceBadge';
import { SHARE_CARD } from './sharedContent/shareCard';

const API_URL = getApiUrl();

type Tab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'glossary';

const getTokenFromPath = () => {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.match(/\/share\/([^/?#]+)/)?.[1] ?? '';
};

/** Panel heading: the tab's own icon in its soft brand chip, so a section is recognisable
 *  at a glance even after the tab bar has scrolled away. */
const SectionHeading: React.FC<{ cfg: StudyTypeIconConfig; label: string }> = ({ cfg, label }) => (
  <div className="mb-5 flex items-center gap-2.5">
    <span className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: cfg.bg }}>
      <cfg.icon size={14} style={{ color: cfg.color }} />
    </span>
    <h2 className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">{label}</h2>
  </div>
);

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

  // The server renders this route's <title> and social meta tags for crawlers
  // (StudyPlatform.API/Controllers/SharePreviewController.cs). Once the app takes over, keep the
  // tab named after the share rather than letting the SPA shell's generic title stand.
  useEffect(() => {
    if (!content?.title) return;
    const previous = document.title;
    document.title = `${content.title} · Toto Study`;
    return () => { document.title = previous; };
  }, [content?.title]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // The bar renders in every state, so it doesn't pop in once the share resolves.
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)]">
        <ShareTopBar copied={copied} onCopy={handleCopy} />
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)]">
        <ShareTopBar copied={copied} onCopy={handleCopy} />
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className={cn(SHARE_CARD, 'max-w-sm space-y-4 p-8 text-center')}>
            <div className="mx-auto w-fit rounded-2xl bg-red-50 p-5 text-red-500"><AlertCircle size={32} /></div>
            <h1 className="text-xl font-black text-text-main">Content Not Found</h1>
            <p className="text-sm text-text-muted">{error}</p>
            <a href="/" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90">
              Go to Toto Study <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const allTabs: { id: Tab; label: string; cfg: StudyTypeIconConfig; available: boolean }[] = [
    { id: 'summary', label: 'Summary', cfg: STUDY_TYPE_ICONS.summary, available: !!content.summary },
    { id: 'mindmap', label: 'Mind Map', cfg: STUDY_TYPE_ICONS.mindmap, available: !!content.mindMapText },
    { id: 'notes', label: content.sourceType === 'chat' ? 'Conversation' : 'Notes', cfg: content.sourceType === 'chat' ? STUDY_TYPE_ICONS.chat : STUDY_TYPE_ICONS.notes, available: !!content.notesHtml },
    { id: 'flashcards', label: 'Flashcards', cfg: STUDY_TYPE_ICONS.flashcard, available: !!(content.flashcards?.length) },
    { id: 'glossary', label: 'Glossary', cfg: STUDY_TYPE_ICONS.glossary, available: !!(content.glossary?.length) },
    { id: 'quiz', label: 'Quiz', cfg: STUDY_TYPE_ICONS.quiz, available: !!(content.quizzes?.length) },
  ];
  const tabs = allTabs.filter(t => t.available);
  const activeCfg = tabs.find(t => t.id === activeTab)?.cfg ?? STUDY_TYPE_ICONS.summary;
  const activeLabel = tabs.find(t => t.id === activeTab)?.label ?? '';

  const createdAt = new Date(content.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const normalizedSourceType = (content.sourceType === 'youtube' && content.sourceUrl?.includes('bilibili.com')
    ? 'bilibili'
    : content.sourceType === 'youtube' && content.sourceUrl?.startsWith('video/')
      ? 'upload'
      : content.sourceType) as NormalizedSourceType;

  return (
    <div className="relative min-h-screen bg-[var(--bg-app)]">
      {/* Soft brand wash behind the stack — keeps a public page from reading as a bare form. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            'radial-gradient(60% 100% at 20% 0%, rgba(5,150,105,0.10), transparent 70%),'
            + 'radial-gradient(50% 100% at 85% 10%, rgba(8,145,178,0.10), transparent 70%)',
        }}
      />

      <ShareTopBar copied={copied} onCopy={handleCopy} />

      <div className="relative mx-auto max-w-3xl space-y-5 px-4 pb-14 pt-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(SHARE_CARD, 'overflow-hidden')}
        >
          <div className="h-1 w-full bg-gradient-to-r from-primary via-cyan-500 to-primary/30" />
          <div className="p-6 sm:p-7">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {content.sourceType === 'chat' ? <MessageCircle size={11} /> : <Share2 size={11} />}
                {content.sourceType === 'chat' ? 'Shared Conversation' : 'Shared Study Content'}
              </span>
              <SourceBadge type={normalizedSourceType} />
            </div>

            <h1 className="text-2xl font-black leading-tight tracking-tight text-text-main sm:text-[28px]">
              {content.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-app)] px-2.5 py-1 text-xs font-semibold text-text-muted">
                <User size={12} /> {content.ownerName}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-app)] px-2.5 py-1 text-xs font-semibold text-text-muted">
                <Calendar size={12} /> {createdAt}
              </span>
              {content.expiresAt && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
                  <Clock size={12} /> Expires {new Date(content.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </motion.div>

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
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
            {tabs.map(({ id, label, cfg }) => {
              // The selected tab wears its own study-type colour — the same one the panel heading
              // and the rest of the app use for that material — as a tint plus an inset ring.
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold transition-all',
                    active
                      ? 'border-transparent shadow-sm'
                      : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] text-text-muted hover:border-primary/40 hover:text-text-main',
                  )}
                  style={active ? { background: cfg.bg, color: cfg.color, boxShadow: `inset 0 0 0 1.5px ${cfg.color}` } : undefined}
                >
                  <cfg.icon size={14} style={{ color: cfg.color }} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab ?? 'empty'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {activeTab === 'summary' && content.summary && (
              <div className={cn(SHARE_CARD, 'p-6 sm:p-7')}>
                <SectionHeading cfg={activeCfg} label="Summary" />
                <div className="summary-content select-text px-0 py-0">
                  <SummaryMarkdown value={content.summary} />
                </div>
              </div>
            )}

            {activeTab === 'mindmap' && content.mindMapText && (
              <div className={cn(SHARE_CARD, 'p-4 sm:p-5')}>
                <div className="px-2">
                  <SectionHeading cfg={activeCfg} label="Mind Map" />
                </div>
                <MarkmapView text={content.mindMapText} />
              </div>
            )}

            {activeTab === 'notes' && content.notesHtml && (
              <div className={cn(SHARE_CARD, 'p-6 sm:p-7')}>
                <SectionHeading cfg={activeCfg} label={activeLabel} />
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
              <div className={cn(SHARE_CARD, 'p-6 sm:p-7')}>
                <SectionHeading cfg={activeCfg} label="Flashcards" />
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
              <div className={cn(SHARE_CARD, 'p-6 sm:p-7')}>
                <SectionHeading cfg={activeCfg} label="Quiz" />
                <SharedQuiz questions={content.quizzes} title={content.title} />
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <div className={cn(SHARE_CARD, 'overflow-hidden text-center')}>
          <div className="bg-gradient-to-b from-primary/[0.07] to-transparent p-7">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles size={20} className="text-primary" />
            </span>
            <p className="mb-1 text-lg font-black text-text-main">Want to create your own study materials?</p>
            <p className="mx-auto mb-5 max-w-md text-sm text-text-muted">
              Upload documents, videos, podcasts or articles and get AI-generated summaries, mind maps, quizzes and flashcards.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="/" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
                Try Toto Study <ArrowRight size={15} />
              </a>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-6 py-2.5 text-sm font-bold text-text-muted transition-colors hover:border-primary/50 hover:text-text-main"
              >
                <Github size={15} /> View on GitHub
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
