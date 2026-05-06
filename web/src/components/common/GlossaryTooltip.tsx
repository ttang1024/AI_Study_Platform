import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { BookMarked, X } from 'lucide-react';
import { GlossaryTerm } from '../../types';
import { cn } from '../../utils/cn';

interface GlossaryTooltipProps {
  term: GlossaryTerm;
  children: React.ReactNode;
  className?: string;
}

export const GlossaryTooltip: React.FC<GlossaryTooltipProps> = ({ term, children, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleOpen = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 280;
    let left = rect.left + window.scrollX;
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16;
    }
    setPos({
      top: rect.bottom + window.scrollY + 6,
      left: Math.max(8, left),
    });
    setIsOpen(v => !v);
  };

  return (
    <>
      <span
        ref={triggerRef}
        onClick={handleOpen}
        className={cn(
          'cursor-pointer border-b border-dotted border-primary/50 text-primary hover:border-primary transition-colors',
          className,
        )}
        title={`Definition: ${term.term}`}
      >
        {children}
      </span>

      {isOpen && ReactDOM.createPortal(
        <div
          className="fixed z-[9999] w-[280px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl p-4"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <BookMarked size={14} className="text-primary shrink-0" />
              <span className="font-black text-sm text-primary">{term.term}</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-muted hover:text-primary transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">{term.definition}</p>
          {term.sourceName && (
            <p className="text-[10px] text-text-muted mt-2 pt-2 border-t border-[var(--border-color)]">
              Source: {term.sourceName}
            </p>
          )}
        </div>,
        document.body,
      )}
    </>
  );
};
