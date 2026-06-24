import { useCallback, useState } from 'react';
import type { SelectionToolbar } from './useVideoDetail';

/**
 * Tracks a floating toolbar anchored to the current text selection.
 * `onMouseUp` reads `window.getSelection()` and positions the toolbar above the
 * selected range (or clears it when the selection is empty).
 */
export function useSelectionToolbar() {
  const [toolbar, setToolbar] = useState<SelectionToolbar | null>(null);

  const onMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection?.rangeCount) { setToolbar(null); return; }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setToolbar({ x: rect.left + rect.width / 2, y: rect.top - 12, text });
  }, []);

  return { toolbar, setToolbar, onMouseUp };
}
