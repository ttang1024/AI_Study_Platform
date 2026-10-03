import React from 'react';
import ReactDOM from 'react-dom';
import { X, Keyboard } from 'lucide-react';

interface ShortcutEntry {
  keys: string[];
  description: string;
}

const SHORTCUTS: { group: string; items: ShortcutEntry[] }[] = [
  {
    group: 'Navigation',
    items: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'L'], description: 'Go to Library' },
      { keys: ['G', 'F'], description: 'Go to Flashcards' },
      { keys: ['G', 'Q'], description: 'Go to Quizzes' },
      { keys: ['G', 'N'], description: 'Go to Notes' },
    ],
  },
  {
    group: 'Actions',
    items: [
      { keys: ['⌘', 'K'], description: 'Command palette (search + go to page)' },
      { keys: ['/'], description: 'Open global search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
];

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 rounded border border-zinc-300 bg-zinc-100 px-1.5 text-[11px] font-mono font-bold text-zinc-700 shadow-sm">
    {children}
  </kbd>
);

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-primary" />
            <h2 className="font-bold text-text-main">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-[var(--bg-app)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {SHORTCUTS.map(group => (
            <div key={group.group}>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">{group.group}</p>
              <div className="space-y-2">
                {group.items.map(item => (
                  <div key={item.description} className="flex items-center justify-between">
                    <span className="text-sm text-text-main">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <React.Fragment key={i}>
                          <Kbd>{k}</Kbd>
                          {i < item.keys.length - 1 && <span className="text-xs text-text-muted">then</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};
