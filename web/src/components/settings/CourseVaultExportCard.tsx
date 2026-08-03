import React, { useState } from 'react';
import { FolderTree, Loader2 } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';
import { integrationsService } from '../../services/integrationsService';

/**
 * Per-course Markdown vault export, built server-side.
 *
 * Distinct from the whole-library "Obsidian Vault" card above it, which is assembled in the browser
 * from what the client already holds. This one is scoped to one course and cross-links its notes
 * with `[[wiki links]]`, which needs the server's view of what belongs to what — so it is offered
 * as its own card rather than folded into that one.
 */
export const CourseVaultExportCard: React.FC = () => {
  const { courses } = useStudy();
  const [courseId, setCourseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    if (!courseId) return;
    setBusy(true); setError(null);
    try {
      const response = await integrationsService.exportMarkdown(courseId);
      const course = courses.find(c => c.id === courseId);

      // The blob is turned into a click on an object URL rather than a navigation, because the
      // request needs the Authorization header that only the HTTP client attaches.
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${course?.name ?? 'course'}-obsidian.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not build that export.');
    } finally {
      setBusy(false);
    }
  };

  if (courses.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
          <FolderTree size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-text-main">Course vault (linked)</h4>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            One course as a Markdown folder with <code>[[wiki links]]</code> between its sources,
            notes, flashcards and glossary. Opens as an Obsidian vault.
          </p>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-xs"
            >
              <option value="">Pick a course…</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={download}
              disabled={busy || !courseId}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-main hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              {busy ? 'Building…' : 'Export ZIP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
