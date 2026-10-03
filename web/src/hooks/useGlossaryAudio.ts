import { useCallback, useMemo, useState } from 'react';
import { usePersistentTts } from '../context/TtsContext';
import { synthesizeToBlob, downloadAudioBlob } from '../services/edgeTtsService';

interface AudioTerm {
  id: string;
  term: string;
  definition: string;
}

/** Glossary TTS playback + TXT/MP3 download. `playTerms` is the selection (or full filtered list when none selected). */
export function useGlossaryAudio(
  playTerms: AudioTerm[],
  selectedIds: Set<string>,
  masteryFilter: 'all' | 'unmastered' | 'mastered',
) {
  const [downloadingMp3, setDownloadingMp3] = useState(false);

  // ttsItems derives from playTerms — selection (or, when empty, the filtered list) drives playback
  const ttsItems = useMemo(
    () => playTerms.map(t => ({ text: `${t.term}. ${t.definition}`, title: t.term })),
    [playTerms],
  );

  const getTtsSubtitle = useCallback(
    (index: number, itemCount: number) =>
      `Term ${index + 1} / ${itemCount}${masteryFilter !== 'all' ? ` · ${masteryFilter}` : ''}`,
    [masteryFilter],
  );

  const { playerState, play } = usePersistentTts('glossary', ttsItems, {
    getSubtitle: getTtsSubtitle,
  });

  const handleDownloadTxt = useCallback(() => {
    if (playTerms.length === 0) return;
    const text = playTerms.map(t => `${t.term}\n${t.definition}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedIds.size > 0 ? 'glossary_selected' : 'glossary'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [playTerms, selectedIds]);

  const handleDownloadMp3 = useCallback(async () => {
    if (playTerms.length === 0 || downloadingMp3) return;
    setDownloadingMp3(true);
    try {
      const text = playTerms.map(t => `${t.term}. ${t.definition}`).join('\n\n');
      const blob = await synthesizeToBlob(text);
      const name = selectedIds.size > 0 ? 'glossary_selected' : 'glossary';
      downloadAudioBlob(blob, name);
    } catch {
      // Surface nothing intrusive; synthesis errors are rare and retryable
    } finally {
      setDownloadingMp3(false);
    }
  }, [playTerms, selectedIds, downloadingMp3]);

  return { playerState, play, downloadingMp3, handleDownloadTxt, handleDownloadMp3 };
}
