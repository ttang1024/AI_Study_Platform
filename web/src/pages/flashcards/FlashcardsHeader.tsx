import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, Upload, Download, GraduationCap, ImagePlus } from 'lucide-react';

interface FlashcardsHeaderProps {
  /** The search/import/export toolbar only shows on the sets tab. */
  showToolbar: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onImport: () => void;
  onOcclusion: () => void;
  onExportAnki: () => void;
  exporting: boolean;
}

/** Page title, practice-test link, and the sets-tab toolbar. */
export const FlashcardsHeader: React.FC<FlashcardsHeaderProps> = ({
  showToolbar,
  searchQuery,
  onSearchChange,
  onImport,
  onOcclusion,
  onExportAnki,
  exporting,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
    <div className="flex flex-col gap-3">
      <h1 className="text-4xl font-black tracking-tight text-text-main">
        Study <span className="text-primary">Flashcards</span>
      </h1>
      <p className="text-sm text-zinc-500 font-medium max-w-2xl">
        Master your subjects with active recall and spaced repetition.
      </p>
      <Link
        to="/quizzes?tab=practice"
        className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/15 transition-colors"
      >
        <GraduationCap size={15} /> Start a practice test
      </Link>
    </div>
    {showToolbar && (
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="Search sets..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--primary)] transition-all"
          />
        </div>
        <button
          onClick={onImport}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm font-medium text-text-muted hover:text-text-main hover:border-[var(--primary)]/40 transition-all"
          title="Import from Anki / CSV"
        >
          <Upload size={15} />
          <span className="hidden sm:inline">Import</span>
        </button>
        <button
          onClick={onOcclusion}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm font-medium text-text-muted hover:text-text-main hover:border-[var(--primary)]/40 transition-all"
          title="Create an image-occlusion card (hide parts of a diagram)"
        >
          <ImagePlus size={15} />
          <span className="hidden sm:inline">Occlusion</span>
        </button>
        <button
          onClick={onExportAnki}
          disabled={exporting}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm font-medium text-text-muted hover:text-text-main hover:border-[var(--primary)]/40 transition-all disabled:opacity-50"
          title="Export to Anki (.apkg with scheduling) — respects the selected course filter"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          <span className="hidden sm:inline">Anki</span>
        </button>
      </div>
    )}
  </div>
);
