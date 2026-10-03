import { useEffect } from 'react';

export interface Shortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      for (const shortcut of shortcuts) {
        // Bare-key shortcuts stay quiet while typing; modifier chords (⌘K) fire everywhere.
        if (isTyping && !shortcut.meta && !shortcut.ctrl) continue;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : true;
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : true;
        const noUnwanted = !shortcut.meta && !shortcut.ctrl ? !e.metaKey && !e.ctrlKey : true;

        if (keyMatch && metaMatch && ctrlMatch && shiftMatch && noUnwanted) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
