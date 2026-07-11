import type { Note } from '@/types';

// Note HTML can exceed practical route-param limits, so the editor screen takes
// its input through this module-level store — the same hand-off pattern as
// examSessionStore (utils/examSession.ts).
interface NoteEditorSession {
  note: Note;
  onSaved: (updated: Note) => void;
}

let current: NoteEditorSession | null = null;

export const noteEditorStore = {
  set(session: NoteEditorSession): void {
    current = session;
  },
  take(): NoteEditorSession | null {
    const session = current;
    current = null;
    return session;
  },
};
