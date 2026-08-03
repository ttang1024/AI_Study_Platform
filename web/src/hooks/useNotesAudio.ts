import { useState, useMemo, useCallback } from 'react';
import { usePersistentTts } from '../context/TtsContext';
import { synthesizeToBlob, downloadAudioBlob } from '../services/edgeTtsService';
import { UnifiedNoteItem } from './useNotesData';
import { stripHtml } from '@core/utils/stripHtml';

/** TTS playback + MP3 download for a list of notes (the selection, or all filtered notes). */
export function useNotesAudio({
  filteredItems,
  selectedIds,
}: {
  filteredItems: UnifiedNoteItem[];
  selectedIds: Set<string>;
}) {
  const [downloadingMp3, setDownloadingMp3] = useState(false);

  // Notes that Play will read: the current selection, or the full filtered list when nothing is selected
  const playItems = useMemo(
    () => (selectedIds.size > 0
      ? filteredItems.filter(i => selectedIds.has(i.type !== 'video' ? i.note.id : i.entry.noteId))
      : filteredItems),
    [filteredItems, selectedIds],
  );

  const ttsItems = useMemo(
    () => playItems.map((item, i) => {
      const title = item.type !== 'video' ? item.docName : item.entry.title;
      const content = item.type !== 'video' ? item.note.content : item.entry.content;
      return { text: `Note ${i + 1}: ${title}. ${stripHtml(content)}`, title };
    }),
    [playItems],
  );

  const getTtsSubtitle = useCallback(
    (index: number, itemCount: number) => `Note ${index + 1} / ${itemCount}`,
    [],
  );

  const { playerState, play } = usePersistentTts('notes', ttsItems, {
    getSubtitle: getTtsSubtitle,
  });

  const handleDownloadMp3 = useCallback(async () => {
    if (ttsItems.length === 0 || downloadingMp3) return;
    setDownloadingMp3(true);
    try {
      const text = ttsItems.map(i => i.text).join('\n\n');
      const blob = await synthesizeToBlob(text);
      const name = selectedIds.size > 0 ? 'notes_selected' : 'notes';
      downloadAudioBlob(blob, name);
    } catch {
      // Synthesis errors are rare and retryable; avoid an intrusive alert
    } finally {
      setDownloadingMp3(false);
    }
  }, [ttsItems, selectedIds, downloadingMp3]);

  return { playItems, playerState, play, downloadingMp3, handleDownloadMp3 };
}
