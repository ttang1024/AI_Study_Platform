import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { List, Loader2, Sparkles, Clock } from 'lucide-react';
import { YouTubeChapter, youtubeChapterService } from '../services/youtubeChapterService';
import { cn } from '../utils/cn';

interface ChapterSidebarProps {
  videoId: string; // DB UUID of the saved video
  youtubeVideoId: string | null; // YouTube video ID (e.g. "dQw4w9WgXcQ")
  chapters: YouTubeChapter[];
  onChaptersLoaded: (chapters: YouTubeChapter[]) => void;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function seekYouTubePlayer(seconds: number): void {
  const iframe = document.getElementById('youtube-player') as HTMLIFrameElement | null;
  if (!iframe) return;
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
    '*'
  );
}

export const ChapterSidebar: React.FC<ChapterSidebarProps> = ({
  videoId,
  youtubeVideoId,
  chapters,
  onChaptersLoaded,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await youtubeChapterService.generateChapters(videoId);
      onChaptersLoaded(generated);
    } catch (e) {
      setError('Failed to generate chapters. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [videoId, onChaptersLoaded]);

  const handleChapterClick = useCallback((chapter: YouTubeChapter) => {
    setActiveChapter(chapter.youTubeChapterId);
    seekYouTubePlayer(chapter.timestampSeconds);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-2">
          <List size={16} className="text-primary" />
          <span className="text-sm font-bold text-text-main">Chapters</span>
          {chapters.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {chapters.length}
            </span>
          )}
        </div>
        {chapters.length === 0 && !isGenerating && (
          <button
            onClick={handleGenerate}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
          >
            <Sparkles size={12} />
            Generate
          </button>
        )}
        {chapters.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="text-[10px] font-bold text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Regenerate
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={24} className="animate-spin text-primary" />
            <p className="text-xs text-text-muted font-medium">Generating chapters...</p>
          </div>
        )}

        {error && (
          <div className="px-4 py-3">
            <p className="text-xs text-red-500 font-medium">{error}</p>
          </div>
        )}

        {!isGenerating && chapters.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
            <Clock size={28} className="text-zinc-300" />
            <p className="text-xs text-text-muted font-medium">
              No chapters yet. Generate them from the video summary.
            </p>
          </div>
        )}

        {!isGenerating && chapters.length > 0 && (
          <AnimatePresence>
            <div className="py-2">
              {chapters.map((chapter, idx) => (
                <motion.button
                  key={chapter.youTubeChapterId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleChapterClick(chapter)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--bg-app)] transition-colors border-b border-[var(--border-color)]/50 last:border-0',
                    activeChapter === chapter.youTubeChapterId && 'bg-primary/5'
                  )}
                >
                  <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary font-mono mt-0.5">
                    {formatTimestamp(chapter.timestampSeconds)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-xs font-semibold leading-tight',
                      activeChapter === chapter.youTubeChapterId ? 'text-primary' : 'text-text-main'
                    )}>
                      {chapter.title}
                    </p>
                    {chapter.summaryText && (
                      <p className="text-[10px] text-text-muted mt-0.5 leading-tight line-clamp-2">
                        {chapter.summaryText}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
