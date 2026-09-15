import React, { useState } from 'react';
import { ShareableGlossaryTerm } from '../../services/shareContentService';
import { GlossaryLetterNav } from '../../components/glossary/GlossaryLetterNav';

export const SharedGlossary: React.FC<{ terms: ShareableGlossaryTerm[] }> = ({ terms }) => {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const grouped = React.useMemo(() => {
    const map: Record<string, ShareableGlossaryTerm[]> = {};
    for (const t of terms) {
      const letter = t.term[0]?.toUpperCase() ?? '#';
      (map[letter] ??= []).push(t);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [terms]);

  const availableLetters = new Set(grouped.map(([l]) => l));

  const scrollToLetter = (letter: string) => {
    document.getElementById(`shared-glossary-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveLetter(letter);
  };

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">Glossary</h2>
        <span className="text-xs text-text-muted">{terms.length} terms</span>
      </div>
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 space-y-6">
          {grouped.map(([letter, letterTerms]) => (
            <div key={letter} id={`shared-glossary-${letter}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl font-black text-primary">{letter}</span>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
                <span className="text-xs text-text-muted">{letterTerms.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {letterTerms.map((t, i) => (
                  <div key={i} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4 hover:border-primary/30 transition-all">
                    <h3 className="font-bold text-text-main leading-snug mb-2">{t.term}</h3>
                    <p className="text-sm text-text-muted leading-relaxed">{t.definition}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* A-Z nav */}
        <GlossaryLetterNav
          availableLetters={availableLetters}
          activeLetter={activeLetter}
          onSelect={scrollToLetter}
        />
      </div>
    </div>
  );
};
