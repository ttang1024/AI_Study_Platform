import React from 'react';
import { Play, Share2, Download, Loader2 } from 'lucide-react';

interface GlossaryHeaderProps {
  totalTerms: number;
  masteredCount: number;
  filteredCount: number;
  selectedCount: number;
  playCount: number;
  masteryFilter: 'all' | 'unmastered' | 'mastered';
  playerIdle: boolean;
  downloadingMp3: boolean;
  onShare: () => void;
  onPlay: () => void;
  onDownloadTxt: () => void;
  onDownloadMp3: () => void;
}

/** Page title, term/mastered stats, and the share / play / download actions. */
export const GlossaryHeader: React.FC<GlossaryHeaderProps> = ({
  totalTerms, masteredCount, filteredCount, selectedCount, playCount,
  masteryFilter, playerIdle, downloadingMp3,
  onShare, onPlay, onDownloadTxt, onDownloadMp3,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
    <div className="space-y-2">
      <h1 className="text-4xl font-black text-text-main">
        Study <span className="text-primary">Glossary</span>
      </h1>
      <p className="text-zinc-500 font-medium">AI-extracted key terms and definitions from all your content.</p>
    </div>
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-3xl font-black text-text-main">{totalTerms}</p>
          <p className="text-xs text-text-muted font-medium">total terms</p>
        </div>
        {masteredCount > 0 && (
          <div className="text-right">
            <p className="text-3xl font-black text-emerald-600">{masteredCount}</p>
            <p className="text-xs text-emerald-500/70 font-medium">mastered</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {filteredCount > 0 && (
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-4 py-2 text-xs font-bold text-text-muted hover:border-primary/50 hover:text-primary transition-all"
          >
            <Share2 size={13} />
            Share
          </button>
        )}
        {filteredCount > 0 && playerIdle && (
          <button
            onClick={onPlay}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 transition-opacity"
          >
            <Play size={13} className="fill-current" />
            {selectedCount > 0
              ? `Play Selected (${playCount})`
              : `Play ${masteryFilter !== 'all' ? `(${filteredCount})` : 'All'}`}
          </button>
        )}
        {filteredCount > 0 && (
          <button
            onClick={onDownloadTxt}
            title="Download as TXT"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-4 py-2 text-xs font-bold text-text-muted hover:border-primary/50 hover:text-primary transition-all"
          >
            <Download size={13} />
            {`TXT${selectedCount > 0 ? ` (${playCount})` : ''}`}
          </button>
        )}
        {filteredCount > 0 && (
          <button
            onClick={onDownloadMp3}
            disabled={downloadingMp3}
            title="Download as MP3"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-4 py-2 text-xs font-bold text-text-muted hover:border-primary/50 hover:text-primary transition-all disabled:opacity-50"
          >
            {downloadingMp3 ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {downloadingMp3
              ? 'Generating…'
              : `MP3${selectedCount > 0 ? ` (${playCount})` : ''}`}
          </button>
        )}
      </div>
    </div>
  </div>
);
