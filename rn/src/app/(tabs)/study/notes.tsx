import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import NotebookPen from 'lucide-react-native/icons/notebook-pen';

import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SearchBar } from '@/components/SearchBar';
import { NoteRow } from '@/components/study/NoteRow';
import { TtsPlayButton } from '@/components/tts/TtsPlayButton';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { usePersistentTts } from '@/context/TtsContext';
import { noteService } from '@/services/noteService';
import type { Note } from '@/types';
import { noteEditorStore } from '@/utils/noteEditorStore';
import { stripHtml } from '@/utils/stripHtml';

type SourceFilter = 'all' | 'document' | 'video';

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Pull-to-refresh runs from an event handler, so the synchronous setState here
  // is fine (unlike the mount effect below).
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { items } = await noteService.list(1, 100);
      setNotes(items);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    noteService.list(1, 100)
      .then(({ items }) => { if (!cancelled) setNotes(items); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const editNote = useCallback((note: Note) => {
    noteEditorStore.set({
      note,
      onSaved: (updated) => setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n))),
    });
    router.push('/study/note-editor');
  }, [router]);

  const deleteNote = useCallback((noteId: string) => {
    Alert.alert('Delete note', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await noteService.remove(noteId);
          setNotes((prev) => prev.filter((n) => n.id !== noteId));
        },
      },
    ]);
  }, []);

  const filtered = notes.filter((note) => {
    if (sourceFilter !== 'all' && note.sourceType !== sourceFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return note.content.toLowerCase().includes(q) || (note.documentName ?? note.videoName ?? '').toLowerCase().includes(q);
  });

  const ttsItems = useMemo(
    () => filtered.map((note, i) => {
      const title = note.documentName ?? note.videoName ?? 'Note';
      return { text: `Note ${i + 1}: ${title}. ${stripHtml(note.content)}`, title };
    }),
    [filtered],
  );
  const { playerState, play, pause, resume } = usePersistentTts('notes', ttsItems, {
    getSubtitle: (index, count) => `Note ${index + 1} / ${count}`,
  });

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search notes…" />
        <View style={styles.filterRow}>
          <FilterChip label="All" active={sourceFilter === 'all'} onPress={() => setSourceFilter('all')} />
          <FilterChip label="Documents" active={sourceFilter === 'document'} onPress={() => setSourceFilter('document')} />
          <FilterChip label="Videos" active={sourceFilter === 'video'} onPress={() => setSourceFilter('video')} />
          {filtered.length > 0 && (
            <TtsPlayButton playerState={playerState} onPlay={() => play(0)} onPause={pause} onResume={resume} />
          )}
        </View>
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No notes yet" subtitle="Add notes from a document or video detail screen." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => <NoteRow note={item} onEdit={editNote} onDelete={deleteNote} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  header: { padding: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  filterRow: { ...Layout.rowWrap, gap: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
});
