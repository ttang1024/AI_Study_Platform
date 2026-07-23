import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import SquareLibrary from 'lucide-react-native/icons/square-library';
import WifiOff from 'lucide-react-native/icons/wifi-off';

import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { InfoBanner } from '@/components/InfoBanner';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SearchBar } from '@/components/SearchBar';
import { GlossaryTermRow } from '@/components/study/GlossaryTermRow';
import { TtsPlayButton } from '@/components/tts/TtsPlayButton';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { usePersistentTts } from '@/context/TtsContext';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { glossaryService } from '@/services/glossaryService';
import { formatLastSync, offlineCache } from '@/services/offlineCache';
import type { GlossaryTerm } from '@/types';

type MasteryFilter = 'all' | 'mastered' | 'unmastered';

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'];

const letterFor = (term: GlossaryTerm): string => {
  const first = term.term.trim()[0]?.toUpperCase() ?? '#';
  return first >= 'A' && first <= 'Z' ? first : '#';
};

/** Fetch + offline fallback, with no state of its own — so the mount effect can
 *  apply the result from the promise callback instead of flipping a spinner on
 *  synchronously (react-hooks/set-state-in-effect). */
const fetchGlossary = async (): Promise<{ terms: GlossaryTerm[]; mastered: string[]; offlineSince: string | null }> => {
  try {
    const [terms, mastered] = await Promise.all([glossaryService.list(), glossaryService.getMasteredIds()]);
    void offlineCache.cacheGlossary(terms, mastered);
    return { terms, mastered, offlineSince: null };
  } catch {
    // Network unreachable — fall back to the last synced snapshot.
    const [cachedTerms, cachedMastered, lastSync] = await Promise.all([
      offlineCache.getCachedGlossary(),
      offlineCache.getCachedGlossaryMastered(),
      offlineCache.getLastSync(),
    ]);
    return { terms: cachedTerms, mastered: cachedMastered, offlineSince: formatLastSync(lastSync) };
  }
};

export default function GlossaryScreen() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>('all');
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const listRef = useRef<SectionList<GlossaryTerm>>(null);
  const pendingJump = useRef<string | null>(null);

  useStudyTimer({ contextType: 'glossary', enabled: !loading });

  useEffect(() => {
    let cancelled = false;
    fetchGlossary().then((result) => {
      if (cancelled) return;
      setTerms(result.terms);
      setMasteredIds(new Set(result.mastered));
      setOfflineSince(result.offlineSince);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Pull-to-refresh runs from an event handler, so setState synchronously is fine.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    const result = await fetchGlossary();
    setTerms(result.terms);
    setMasteredIds(new Set(result.mastered));
    setOfflineSince(result.offlineSince);
    setRefreshing(false);
  }, []);

  const toggleMastered = useCallback(async (termId: string) => {
    const wasMastered = masteredIds.has(termId);
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (wasMastered) next.delete(termId);
      else next.add(termId);
      return next;
    });
    try {
      await glossaryService.toggleMastered(termId);
    } catch {
      setMasteredIds((prev) => {
        const next = new Set(prev);
        if (wasMastered) next.add(termId);
        else next.delete(termId);
        return next;
      });
    }
  }, [masteredIds]);

  const saveTerm = useCallback(async (termId: string, term: string, definition: string) => {
    try {
      const updated = await glossaryService.update(termId, { term, definition });
      setTerms((prev) => prev.map((t) => (t.id === termId ? updated : t)));
    } catch {
      Alert.alert('Couldn’t save', 'The change wasn’t saved — check your connection and try again.');
    }
  }, []);

  const deleteTerm = useCallback((termId: string) => {
    Alert.alert('Delete term', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await glossaryService.remove(termId);
          setTerms((prev) => prev.filter((t) => t.id !== termId));
        },
      },
    ]);
  }, []);

  const filtered = useMemo(() => terms.filter((term) => {
    const mastered = masteredIds.has(term.id);
    if (masteryFilter === 'mastered' && !mastered) return false;
    if (masteryFilter === 'unmastered' && mastered) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return term.term.toLowerCase().includes(q) || term.definition.toLowerCase().includes(q);
  }), [terms, masteredIds, masteryFilter, search]);

  const sections = useMemo(() => {
    const map = new Map<string, GlossaryTerm[]>();
    for (const term of filtered) {
      const letter = letterFor(term);
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(term);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
      .map(([title, data]) => ({ title, data: [...data].sort((x, y) => x.term.localeCompare(y.term)) }));
  }, [filtered]);

  const availableLetters = useMemo(() => new Set(sections.map((s) => s.title)), [sections]);

  const jumpToLetter = useCallback((letter: string) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0) return;
    pendingJump.current = letter;
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, animated: true });
  }, [sections]);

  // Rows have variable heights, so a jump to a not-yet-measured section can
  // fail. Scroll near the target so it renders, then retry once.
  const handleScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    listRef.current?.getScrollResponder()?.scrollTo({ y: info.index * info.averageItemLength, animated: false });
    const letter = pendingJump.current;
    pendingJump.current = null;
    if (letter) {
      setTimeout(() => {
        const sectionIndex = sections.findIndex((s) => s.title === letter);
        if (sectionIndex >= 0) {
          listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, animated: true });
        }
      }, 150);
    }
  }, [sections]);

  const orderedTerms = useMemo(() => sections.flatMap((s) => s.data), [sections]);
  const ttsItems = useMemo(
    () => orderedTerms.map((t) => ({ text: `${t.term}. ${t.definition}`, title: t.term })),
    [orderedTerms],
  );
  const { playerState, play, pause, resume } = usePersistentTts('glossary', ttsItems, {
    getSubtitle: (index, count) => `Term ${index + 1} / ${count}${masteryFilter !== 'all' ? ` · ${masteryFilter}` : ''}`,
  });

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search terms…" />
        {offlineSince !== null && (
          <InfoBanner icon={WifiOff} text={`Offline — showing terms saved on this device (last synced ${offlineSince}).`} />
        )}
        <View style={styles.filterRow}>
          <FilterChip label="All" active={masteryFilter === 'all'} onPress={() => setMasteryFilter('all')} />
          <FilterChip label="Mastered" active={masteryFilter === 'mastered'} onPress={() => setMasteryFilter('mastered')} />
          <FilterChip label="Unmastered" active={masteryFilter === 'unmastered'} onPress={() => setMasteryFilter('unmastered')} />
          {filtered.length > 0 && (
            <TtsPlayButton playerState={playerState} onPlay={() => play(0)} onPause={pause} onResume={resume} />
          )}
        </View>
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon={SquareLibrary} title="No glossary terms yet" subtitle="Generate a glossary from a document or video detail screen." />
      ) : (
        <View style={styles.listWrap}>
          <SectionList
            ref={listRef}
            sections={sections}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled
            onScrollToIndexFailed={handleScrollToIndexFailed}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={styles.itemWrap}>
                <GlossaryTermRow
                  term={item}
                  mastered={masteredIds.has(item.id)}
                  onToggleMastered={toggleMastered}
                  onSave={saveTerm}
                  onDelete={deleteTerm}
                />
              </View>
            )}
          />
          <View style={styles.letterRail} pointerEvents="box-none">
            {LETTERS.map((letter) => {
              const has = availableLetters.has(letter);
              return (
                <Pressable
                  key={letter}
                  disabled={!has}
                  onPress={() => jumpToLetter(letter)}
                  hitSlop={{ left: 6, right: 6 }}
                >
                  <Text style={[styles.letterText, !has && styles.letterTextDisabled]}>{letter}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  header: { padding: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  filterRow: { ...Layout.rowWrap, gap: Spacing.two },
  listWrap: { flex: 1 },
  list: { paddingLeft: Spacing.three, paddingRight: Spacing.five, paddingBottom: Spacing.five },
  itemWrap: { marginBottom: Spacing.two },
  sectionHeader: { backgroundColor: Colors.bgApp, paddingVertical: 4, marginBottom: 4 },
  sectionHeaderText: { ...Typography.captionBold, color: Colors.primary, letterSpacing: 1 },
  letterRail: {
    position: 'absolute', right: 2, top: 0, bottom: 0,
    ...Layout.center,
  },
  letterText: { fontSize: 10, lineHeight: 13, fontWeight: '800', color: Colors.primary, paddingHorizontal: 2 },
  letterTextDisabled: { color: Colors.border },
});
