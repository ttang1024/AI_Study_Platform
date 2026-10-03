import type { Note } from '@/types';

// Note HTML can exceed practical route-param limits, so the editor screen takes
// its input through this module-level store — the same hand-off pattern as
// examSessionStore (utils/examSession.ts).
export interface NoteEditorSession {
  note: Note;
  onSaved: (updated: Note) => void;
}

let current: NoteEditorSession | null = null;

export const noteEditorStore = {
  set(session: NoteEditorSession): void {
    current = session;
  },

  /**
   * Reads the pending hand-off without consuming it.
   *
   * Split from `clear` on purpose: the editor screen reads this from a `useState` initializer, which
   * React invokes twice under StrictMode. A destructive read there would hand the note to the first
   * invocation and null to the second. Consuming is a side effect, so it belongs in an effect.
   */
  peek(): NoteEditorSession | null {
    return current;
  },

  clear(): void {
    current = null;
  },
};
