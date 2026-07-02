import React from 'react';
import { cn } from '../../utils/cn';

interface GlossaryLetterNavProps {
  availableLetters: Set<string>;
  activeLetter: string | null;
  onSelect: (letter: string) => void;
}

/** Sticky A–Z jump navigation for the grouped glossary list. */
export const GlossaryLetterNav: React.FC<GlossaryLetterNavProps> = ({ availableLetters, activeLetter, onSelect }) => (
  <div className="hidden sm:flex sticky top-6 self-start flex-col items-center gap-px">
    {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ#').map(letter => {
      const has = availableLetters.has(letter);
      const isActive = activeLetter === letter;
      return (
        <button
          key={letter}
          onClick={() => has && onSelect(letter)}
          disabled={!has}
          className={cn(
            'w-6 h-6 rounded text-[11px] font-black flex items-center justify-center transition-all duration-150',
            isActive
              ? 'bg-primary text-white shadow-sm shadow-primary/30'
              : has
                ? 'text-primary hover:bg-primary/10'
                : 'text-zinc-300 cursor-default',
          )}
        >
          {letter}
        </button>
      );
    })}
  </div>
);
