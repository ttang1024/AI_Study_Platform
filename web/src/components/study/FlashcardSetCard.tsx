import React from 'react';
import { BrainCircuit, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { CONTENT_TYPE_ICONS } from '../../constants/contentTypeIcons';

export interface UnifiedSet {
  type: 'doc' | 'video' | 'article' | 'audio';
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  cardCount: number;
  clozeCount: number;
  previewText?: string;
  thumbnailUrl?: string;
  videoPreviewUrl?: string;
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: { opacity: 1, scale: 1, y: 0 },
};

interface FlashcardSetCardProps {
  set: UnifiedSet;
  onSelect: () => void;
  onMobileReview: () => void;
}

export const FlashcardSetCard: React.FC<FlashcardSetCardProps> = ({ set, onMobileReview }) => {
  const cardColor = set.courseColor;

  return (
    <motion.button
      layout
      variants={cardVariants}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onMobileReview}
      className="group relative flex flex-col text-left rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition-all card-hover"
    >
      {/* Stacked Cards Preview */}
      <div className="relative h-36 mb-4">
        <div
          className="absolute inset-x-5 top-4 bottom-0 rounded-xl"
          style={{ backgroundColor: cardColor, opacity: 0.5, transform: 'rotate(4deg)' }}
        />
        <div
          className="absolute inset-x-2.5 top-2 bottom-0 rounded-xl"
          style={{ backgroundColor: cardColor, opacity: 0.25, transform: 'rotate(8deg)' }}
        />
        <div
          className="absolute inset-x-0 top-0 bottom-0 rounded-xl flex flex-col items-start justify-between p-3.5 group-hover:scale-[1.02] transition-transform duration-300"
          style={{ backgroundColor: cardColor, boxShadow: `0 6px 20px ${cardColor}40` }}
        >
          {set.type === 'video' && set.thumbnailUrl && (
            <>
              {set.videoPreviewUrl && (
                <video
                  src={`${set.videoPreviewUrl}#t=0.1`}
                  className="absolute inset-0 h-full w-full rounded-xl object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              )}
              <img
                src={set.thumbnailUrl}
                alt={set.name}
                className="absolute inset-0 h-full w-full rounded-xl object-cover"
                referrerPolicy="no-referrer"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 rounded-xl bg-black/30" />
            </>
          )}
          <div className="flex-1 flex items-center justify-center w-full py-1">
            {set.previewText ? (
              <p className="relative z-10 text-[11px] font-semibold text-white text-center line-clamp-3 leading-snug px-1 drop-shadow-sm">
                {set.previewText}
              </p>
            ) : (
              <BrainCircuit size={22} className="relative z-10 text-white opacity-40" />
            )}
          </div>
          <div className="relative z-10 self-end flex items-center gap-1">
            <div className="rounded-full bg-white/20 px-2 py-1">
              <span className="text-[9px] font-bold text-white">{set.cardCount} cards</span>
            </div>
            {set.clozeCount > 0 && (
              <div className="rounded-full bg-white/30 px-2 py-1">
                <span className="text-[9px] font-bold text-white">{set.clozeCount} cloze</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {set.courseName && (
            <div className="flex items-center gap-1 mb-1">
              {set.type === 'video'
                ? <CONTENT_TYPE_ICONS.video.icon size={15} className="text-red-500" />
                : set.type === 'article'
                  ? <CONTENT_TYPE_ICONS.article.icon size={13} className="text-teal-500" />
                  : set.type === 'audio'
                    ? <CONTENT_TYPE_ICONS.audio.icon size={13} className="text-amber-500" />
                    : <CONTENT_TYPE_ICONS.document.icon size={13} className="text-primary" />
              }
              <span className="text-[10px] font-bold truncate" style={{ color: cardColor }}>{set.courseName}</span>
            </div>
          )}
          <p className="text-xs font-bold text-text-main truncate">{set.name}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            onClick={(e) => { e.stopPropagation(); onMobileReview(); }}
            className="rounded-xl p-2 text-white shrink-0 opacity-75 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: cardColor }}
          >
            <Play size={13} />
          </div>
        </div>
      </div>
    </motion.button>
  );
};
