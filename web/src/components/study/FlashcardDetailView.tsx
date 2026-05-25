import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BrainCircuit, Download, Share2, Youtube } from 'lucide-react';
import { Flashcard, Document } from '../../types';
import { VideoListItem } from '../../services/videoService';
import { Flashcards } from './Flashcards';
import { ShareModal } from '../common/ShareModal';
import { downloadAnkiDeck, downloadCsvDeck } from '../../services/ankiExportService';

type SimpleCard = { id: string; front: string; back: string; cardType?: 'basic' | 'cloze' | 'chart' };

type VideoRecord = Pick<VideoListItem, 'id' | 'title' | 'thumbnailUrl' | 'courseId' | 'courseName' | 'courseColor'>;

type ShareTarget = {
  title: string;
  cards: { front: string; back: string; cardType?: 'basic' | 'cloze' | 'chart' }[];
  sourceType?: 'youtube' | 'article' | 'audio' | 'podcast' | 'document';
  sourceUrl?: string | null;
  originalArticleUrl?: string | null;
};

type DocProps = {
  kind: 'doc';
  docId: string;
  doc: Document | undefined;
  flashcards: Flashcard[];
  onBack: () => void;
};

type VideoProps = {
  kind: 'video';
  video: VideoRecord;
  videoCards: SimpleCard[];
  videoList: VideoListItem[];
  onBack: () => void;
};

export type FlashcardDetailViewProps = DocProps | VideoProps;

export const FlashcardDetailView: React.FC<FlashcardDetailViewProps> = (props) => {
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

  const backButton = (onBack: () => void) => (
    <button
      onClick={onBack}
      className="group flex items-center gap-2 text-zinc-400 hover:text-primary transition-colors font-bold text-sm uppercase tracking-widest"
    >
      <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
      Back to Sets
    </button>
  );

  if (props.kind === 'doc') {
    const { docId, doc, flashcards, onBack } = props;
    const isArticle = !!doc?.originalUrl;
    const isAudio = doc?.type === 'audio';
    const isPodcast = doc?.type === 'podcast';
    const srcType = isArticle ? 'article' : isAudio ? 'audio' : isPodcast ? 'podcast' : 'document';
    const srcUrl = doc?.courseId ? `${doc.courseId}/${docId}` : null;

    const docCards = flashcards.filter(f => f.documentId === docId);

    return (
      <>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-16">
          {backButton(onBack)}
          <div className="rounded-[40px] border border-[var(--border-color)] bg-white py-12 px-10 shadow-xl shadow-primary/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-black text-primary uppercase tracking-widest border border-primary/20">
                  <BrainCircuit size={12} />
                  Active Recall Mode
                </div>
                <h2 className="text-4xl font-black text-text-main">{doc?.name}</h2>
                <p className="text-zinc-400 font-medium">Master this set using spaced repetition and active recall.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => downloadAnkiDeck(docCards.map(f => ({ id: f.id, front: f.front, back: f.back })), doc?.name ?? 'flashcards')}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2 text-sm font-medium text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                  >
                    <Download size={14} />
                    Export TXT
                  </button>
                  <button
                    onClick={() => downloadCsvDeck(docCards.map(f => ({ id: f.id, front: f.front, back: f.back })), doc?.name ?? 'flashcards')}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2 text-sm font-medium text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                  <button
                    onClick={() => setShareTarget({
                      title: doc?.name ?? 'Flashcards',
                      cards: docCards.map(f => ({ front: f.front, back: f.back, cardType: f.cardType })),
                      sourceType: srcType,
                      sourceUrl: srcUrl,
                      originalArticleUrl: isArticle ? (doc?.originalUrl ?? null) : null,
                    })}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2 text-sm font-medium text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                  >
                    <Share2 size={14} />
                    Share
                  </button>
                </div>
              </div>
            </div>
            <Flashcards documentId={docId} />
          </div>
        </motion.div>

        {shareTarget && (
          <ShareModal
            open
            onClose={() => setShareTarget(null)}
            title={shareTarget.title}
            fetchFlashcards={async () => shareTarget.cards}
            sourceType={shareTarget.sourceType}
            sourceUrl={shareTarget.sourceUrl}
            originalArticleUrl={shareTarget.originalArticleUrl}
          />
        )}
      </>
    );
  }

  // Video detail
  const { video, videoCards, videoList, onBack } = props;
  const videoMeta = videoList.find(v => v.id === video.id);

  return (
    <>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-16">
        {backButton(onBack)}
        <div className="rounded-[40px] border border-[var(--border-color)] bg-white py-12 px-10 shadow-xl shadow-red-500/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-1.5 text-[10px] font-black text-red-500 uppercase tracking-widest border border-red-100">
                <Youtube size={12} />
                Video · Active Recall Mode
              </div>
              <h2 className="text-4xl font-black text-text-main">{video.title}</h2>
              <p className="text-zinc-400 font-medium">Master this video using spaced repetition and active recall.</p>
              <button
                onClick={() => setShareTarget({
                  title: video.title,
                  cards: videoCards.map(c => ({ front: c.front, back: c.back, cardType: c.cardType })),
                  sourceType: 'youtube',
                  sourceUrl: videoMeta?.videoUrl ?? null,
                })}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2 text-sm font-medium text-text-muted hover:border-primary/50 hover:text-primary transition-all w-fit"
              >
                <Share2 size={14} />
                Share
              </button>
            </div>
          </div>
          <Flashcards externalCards={videoCards} />
        </div>
      </motion.div>

      {shareTarget && (
        <ShareModal
          open
          onClose={() => setShareTarget(null)}
          title={shareTarget.title}
          fetchFlashcards={async () => shareTarget.cards}
          sourceType={shareTarget.sourceType}
          sourceUrl={shareTarget.sourceUrl}
          originalArticleUrl={shareTarget.originalArticleUrl}
        />
      )}
    </>
  );
};
