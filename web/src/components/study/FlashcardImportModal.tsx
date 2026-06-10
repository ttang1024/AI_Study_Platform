import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { flashcardService } from '../../services/flashcardService';

interface ParsedRow {
  front: string;
  back: string;
  cardType?: string;
  tags?: string[];
}

/**
 * Parses an Anki "Notes in Plain Text" export (.txt) or a generic CSV/TSV.
 * Anki headers like "#separator:tab" are honored; cloze syntax ({{c1::...}})
 * is detected and imported as cloze cards.
 */
function parseAnkiExport(text: string): ParsedRow[] {
  let separator = '\t';
  const lines = text.split(/\r?\n/);
  const rows: ParsedRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith('#')) {
      const m = line.match(/^#separator:(.+)$/i);
      if (m) {
        const sep = m[1].trim().toLowerCase();
        separator = sep === 'tab' ? '\t' : sep === 'comma' ? ',' : sep === 'semicolon' ? ';' : sep;
      }
      continue;
    }

    // Fall back to comma/semicolon when the line has no tab at all.
    const actualSep = line.includes('\t') ? '\t' : line.includes(separator) ? separator : line.includes(';') ? ';' : ',';
    const parts = line.split(actualSep);
    if (parts.length < 2) continue;

    const clean = (s: string) => s
      .replace(/^"|"$/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    const front = clean(parts[0]);
    const back = clean(parts[1]);
    if (!front || !back) continue;

    // Anki puts tags in the last column, space-separated.
    const tags = parts.length > 2
      ? clean(parts[parts.length - 1]).split(/\s+/).filter((t) => t && t.length <= 40).slice(0, 10)
      : undefined;

    rows.push({
      front,
      back,
      cardType: /\{\{c\d+::/.test(front) ? 'cloze' : 'basic',
      tags: tags && tags.length > 0 ? tags : undefined,
    });
  }
  return rows;
}

export const FlashcardImportModal: React.FC<{ onClose: () => void; onImported: () => void }> = ({ onClose, onImported }) => {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; skippedCount: number } | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError('');
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseAnkiExport(text);
    if (parsed.length === 0) {
      setError('No cards found. Expected one card per line: front<TAB>back (Anki "Notes in Plain Text" export).');
      setRows([]);
      return;
    }
    setRows(parsed);
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      const res = await flashcardService.importFlashcards(rows);
      setResult(res);
      onImported();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Import failed. Try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[92vw] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-teal-600" />
            <h2 className="text-sm font-bold text-text-main">Import from Anki / CSV</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="text-center py-4">
              <CheckCircle2 size={28} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm font-semibold text-text-main">
                Imported {result.importedCount} card{result.importedCount === 1 ? '' : 's'}
              </p>
              {result.skippedCount > 0 && (
                <p className="text-xs text-gray-400 mt-1">{result.skippedCount} skipped (duplicates or empty)</p>
              )}
              <button
                onClick={onClose}
                className="mt-4 bg-teal-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-teal-700"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-teal-300 transition-colors"
              >
                <FileText size={22} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-text-main">{fileName || 'Choose a .txt / .csv / .tsv file'}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Anki: File → Export → "Notes in Plain Text". Cloze cards are detected automatically.
                </p>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".txt,.csv,.tsv,text/plain,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />

              {rows.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-600">
                    <span className="font-bold text-text-main">{rows.length}</span> cards parsed
                    {rows.some((r) => r.cardType === 'cloze') && (
                      <span> · {rows.filter((r) => r.cardType === 'cloze').length} cloze</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1 truncate">e.g. "{rows[0].front}"</p>
                </div>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                onClick={handleImport}
                disabled={rows.length === 0 || importing}
                className="w-full inline-flex items-center justify-center gap-2 bg-teal-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50"
              >
                {importing && <Loader2 size={14} className="animate-spin" />}
                Import {rows.length > 0 ? `${rows.length} cards` : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
