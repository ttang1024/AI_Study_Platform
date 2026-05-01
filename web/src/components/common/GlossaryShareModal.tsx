import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Copy, Check, Loader2, ExternalLink, Search } from 'lucide-react';
import { createShare, CreateSharePayload } from '../../services/shareContentService';
import { GlossaryTerm } from '../../types';
import { cn } from '../../utils/cn';

interface GlossaryShareModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  terms: GlossaryTerm[];
  sourceType?: CreateSharePayload['sourceType'];
  sourceUrl?: string | null;
  originalArticleUrl?: string | null;
}

export const GlossaryShareModal: React.FC<GlossaryShareModalProps> = ({ open, onClose, title, terms, sourceType, sourceUrl, originalArticleUrl }) => {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(terms.map(t => t.id)));
  const [search, setSearch] = useState('');
  const [step, setStep] = useState<'select' | 'generating' | 'done'>('select');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = terms.filter(t =>
    !search.trim() || t.term.toLowerCase().includes(search.toLowerCase()) || t.definition.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filtered.every(t => selected.has(t.id))) {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(t => next.delete(t.id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(t => next.add(t.id)); return next; });
    }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(t => selected.has(t.id));
  const selectedTerms = terms.filter(t => selected.has(t.id));

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    setError(null);
    try {
      const result = await createShare({
        title,
        glossaryTerms: selectedTerms.map(t => ({ term: t.term, definition: t.definition })),
        sourceType: sourceType ?? null,
        sourceUrl: sourceUrl ?? null,
        originalArticleUrl: originalArticleUrl ?? null,
      });
      setShareUrl(result.shareUrl);
      setStep('done');
    } catch {
      setError('Failed to generate share link. Please try again.');
      setStep('select');
    }
  }, [title, selectedTerms]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStep('select');
    setShareUrl('');
    setCopied(false);
    setError(null);
    setSearch('');
    setSelected(new Set(terms.map(t => t.id)));
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="relative w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Share2 size={16} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-main">Share Glossary</h2>
                  <p className="text-xs text-text-muted truncate max-w-[220px]">{title}</p>
                </div>
              </div>
              <button onClick={handleClose} className="rounded-lg p-1.5 text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 flex flex-col flex-1 min-h-0">
              {step === 'done' ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                      <Check size={20} className="text-emerald-600" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-800">Share link created!</p>
                    <p className="text-xs text-emerald-600 mt-0.5">{selectedTerms.length} term{selectedTerms.length !== 1 ? 's' : ''} shared.</p>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-zinc-50 px-3 py-2.5">
                    <span className="flex-1 text-xs text-text-main truncate font-mono">{shareUrl}</span>
                    <button
                      onClick={handleCopy}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0',
                        copied ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-white hover:opacity-90'
                      )}
                    >
                      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>

                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--border-color)] py-2.5 text-sm font-medium text-text-muted hover:text-primary hover:border-primary/30 transition-all"
                  >
                    <ExternalLink size={14} />
                    Open shared page
                  </a>
                </div>
              ) : (
                <>
                  {/* Search + select all */}
                  <div className="space-y-2 shrink-0">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Filter terms..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] py-2 pl-8 pr-3 text-sm outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={toggleAll}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        {allFilteredSelected ? 'Deselect all' : 'Select all'}
                      </button>
                      <span className="text-xs text-text-muted">{selected.size} of {terms.length} selected</span>
                    </div>
                  </div>

                  {/* Term list */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-text-muted text-center py-6">No terms match your search.</p>
                    ) : (
                      filtered.map(term => {
                        const isSelected = selected.has(term.id);
                        return (
                          <button
                            key={term.id}
                            onClick={() => toggle(term.id)}
                            className={cn(
                              'w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                              isSelected
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-[var(--border-color)] hover:border-primary/20'
                            )}
                          >
                            <div className={cn(
                              'mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all',
                              isSelected ? 'border-primary bg-primary' : 'border-zinc-300'
                            )}>
                              {isSelected && <Check size={9} className="text-white" />}
                            </div>
                            <div className="min-w-0">
                              <p className={cn('text-sm font-semibold leading-snug', isSelected ? 'text-primary' : 'text-text-main')}>{term.term}</p>
                              <p className="text-xs text-text-muted line-clamp-1 mt-0.5">{term.definition}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {error && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 shrink-0">{error}</p>
                  )}

                  <button
                    onClick={handleGenerate}
                    disabled={selected.size === 0 || step === 'generating'}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all shrink-0',
                      selected.size > 0
                        ? 'bg-primary text-white hover:opacity-90'
                        : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                    )}
                  >
                    {step === 'generating' ? (
                      <><Loader2 size={16} className="animate-spin" /> Generating link…</>
                    ) : (
                      <><Share2 size={16} /> Share {selected.size} Term{selected.size !== 1 ? 's' : ''}</>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
