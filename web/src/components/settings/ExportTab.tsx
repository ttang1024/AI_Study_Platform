import React from 'react';
import { Link } from 'react-router-dom';
import { Info, Download, Archive, FileText, CloudDownload } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';
import { gamificationService } from '../../services/gamificationService';
import { useSettingsExport } from '../../hooks/useSettingsExport';

export const ExportTab: React.FC = () => {
  const { allNotes } = useStudy();
  const { exporting, handleExport } = useSettingsExport();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-text-main">Export and Interop</h3>
        <p className="text-sm text-text-muted mt-1">
          Download your learning materials for review, backup, Obsidian, and LMS import.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            id: 'notes' as const,
            title: 'Markdown Notes',
            description: `${allNotes.length} notes as one Markdown file.`,
            icon: FileText,
            label: 'Export MD',
          },
          {
            id: 'pdf' as const,
            title: 'PDF Study Pack',
            description: 'Notes, quizzes, flashcards, and glossary in a printable pack.',
            icon: Download,
            label: 'Export PDF',
          },
          {
            id: 'obsidian' as const,
            title: 'Obsidian Vault',
            description: 'ZIP with Markdown folders for notes, quizzes, flashcards, and glossary.',
            icon: Archive,
            label: 'Export ZIP',
          },
          {
            id: 'quizCsv' as const,
            title: 'Quiz CSV',
            description: 'Question bank CSV for spreadsheets and generic import tools.',
            icon: FileText,
            label: 'Export CSV',
          },
          {
            id: 'qti' as const,
            title: 'LMS QTI Package',
            description: 'QTI 1.2 ZIP for LMS question import workflows.',
            icon: Archive,
            label: 'Export QTI',
          },
        ].map(option => (
          <div key={option.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shrink-0">
                <option.icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-text-main">{option.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{option.description}</p>
                <button
                  type="button"
                  onClick={() => handleExport(option.id)}
                  disabled={exporting !== null}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-main hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting === option.id ? 'Exporting...' : option.label}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
        <Info size={14} className="mt-0.5 text-[var(--primary)] shrink-0" />
        <p className="text-[10px] leading-relaxed text-zinc-500">
          LMS packages include quiz questions that can be reloaded from submitted quiz sources. Sources without available generated questions are skipped.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-text-main">Capture & Calendar</h3>
        <p className="text-sm text-text-muted mt-1">
          Clip web pages into your library from anywhere, and see your study schedule in your calendar app.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
          <h4 className="font-semibold text-text-main">Web Clipper bookmarklet</h4>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Drag this button to your bookmarks bar. On any article, click it to clip the page into your library.
          </p>
          <a
            href={`javascript:(function(){window.open('${window.location.origin}/summarizer?tab=web&clip='+encodeURIComponent(location.href),'_blank');})();`}
            onClick={(e) => e.preventDefault()}
            draggable
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white cursor-grab"
            title="Drag me to your bookmarks bar"
          >
            📎 Clip to Easy Study
          </a>
          <p className="mt-2 text-[10px] text-zinc-400">
            A browser-extension version lives in the repo's <code>extension/</code> folder.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
          <h4 className="font-semibold text-text-main">Offline studying</h4>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Flashcards and glossary terms are cached on this device so you can keep reviewing without a connection.
          </p>
          <Link
            to="/offline"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-main hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <CloudDownload size={13} /> Manage offline content
          </Link>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
          <h4 className="font-semibold text-text-main">Calendar feed (.ics)</h4>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Flashcards due per day, planned study blocks, and exam dates for the next two weeks — importable into Google, Apple, or Outlook calendars.
          </p>
          <button
            type="button"
            onClick={async () => {
              try {
                const blob = await gamificationService.downloadCalendarIcs();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'easy-study.ics';
                a.click();
                URL.revokeObjectURL(url);
              } catch { /* best-effort download */ }
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-main hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Download size={13} /> Download .ics
          </button>
        </div>
      </div>
    </div>
  );
};
