import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Bug from 'lucide-react-native/icons/bug';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Layers from 'lucide-react-native/icons/layers';
import Upload from 'lucide-react-native/icons/upload';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import Zap from 'lucide-react-native/icons/zap';

import { EmptyState } from '@/components/EmptyState';
import { IconBadge } from '@/components/IconBadge';
import { InfoBanner } from '@/components/InfoBanner';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SearchBar } from '@/components/SearchBar';
import { PressableScale } from '@/components/PressableScale';
import { Alpha, Colors, Gradients, Layout, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { flashcardService } from '@/services/flashcardService';
import { formatLastSync, offlineCache } from '@/services/offlineCache';
import type { Flashcard } from '@/types';
import { parseAnkiExport } from '@/utils/ankiImport';
import { getApiErrorMessage } from '@/utils/apiError';
import { groupFlashcardSets, type FlashcardSet } from '@/utils/flashcardSets';

/** Fetch + offline fallback, with no state of its own — so the mount effect can
 *  apply the result from the promise callback instead of flipping a spinner on
 *  synchronously (react-hooks/set-state-in-effect). */
const fetchCards = async (): Promise<{ cards: Flashcard[]; offlineSince: string | null }> => {
  try {
    const { items } = await flashcardService.list();
    void offlineCache.cacheFlashcards(items);
    return { cards: items, offlineSince: null };
  } catch {
    // Network unreachable — fall back to the last synced snapshot.
    const [cached, lastSync] = await Promise.all([offlineCache.getCachedFlashcards(), offlineCache.getLastSync()]);
    return { cards: cached, offlineSince: formatLastSync(lastSync) };
  }
};

export default function FlashcardsScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [offlineSince, setOfflineSince] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCards().then((result) => {
      if (cancelled) return;
      setCards(result.cards);
      setOfflineSince(result.offlineSince);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // The spinner is safe to flip on here — this runs from an event handler
  // (after an import), not from an effect.
  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchCards();
    setCards(result.cards);
    setOfflineSince(result.offlineSince);
    setLoading(false);
  }, []);

  // Pull-to-refresh drives the inline spinner instead of the full-screen loader.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    const result = await fetchCards();
    setCards(result.cards);
    setOfflineSince(result.offlineSince);
    setRefreshing(false);
  }, []);

  // Anki "Notes in Plain Text" (.txt) or generic CSV/TSV → POST /api/flashcards/import.
  const importCards = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;

    let rows: ReturnType<typeof parseAnkiExport>;
    try {
      rows = parseAnkiExport(await new File(asset.uri).text());
    } catch {
      Alert.alert('Import failed', 'Couldn’t read that file.');
      return;
    }
    if (rows.length === 0) {
      Alert.alert('No cards found', 'Expected one card per line: front<TAB>back (Anki: File → Export → "Notes in Plain Text").');
      return;
    }

    const clozeCount = rows.filter((r) => r.cardType === 'cloze').length;
    Alert.alert(
      'Import flashcards',
      `${rows.length} card${rows.length === 1 ? '' : 's'} parsed${clozeCount > 0 ? ` (${clozeCount} cloze)` : ''} from “${asset.name}”.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            try {
              const res = await flashcardService.importFlashcards(rows);
              Alert.alert(
                'Import complete',
                `Imported ${res.importedCount} card${res.importedCount === 1 ? '' : 's'}${res.skippedCount > 0 ? ` · ${res.skippedCount} skipped (duplicates or empty)` : ''}.`,
              );
              reload();
            } catch (e) {
              Alert.alert('Import failed', getApiErrorMessage(e, 'Import failed. Try again.'));
            }
          },
        },
      ],
    );
  }, [reload]);

  // Grouping rebuilds every FlashcardSet object, so it has to be memoized for the memoized
  // rows below to hold — filtering keeps the surviving objects by reference, which is what
  // lets rows skip re-rendering while the search box is being typed in.
  const allSets = useMemo(() => groupFlashcardSets(cards), [cards]);
  const sets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? allSets.filter((set) => set.name.toLowerCase().includes(query)) : allSets;
  }, [allSets, search]);
  const totalDue = useMemo(() => sets.reduce((sum, set) => sum + set.dueCount, 0), [sets]);
  // Computed client-side from the already-loaded deck (same rule as the server's
  // GET /api/flashcards/leeches — lapses ≥ 4) so the badge costs no extra request.
  const leechCount = useMemo(() => cards.filter((c) => (c.srs?.lapses ?? 0) >= 4).length, [cards]);

  const openDeck = useCallback(
    (key: string) => router.push(`/study/flashcards/deck/${key}`),
    [router],
  );
  const renderDeck = useCallback(
    ({ item }: { item: FlashcardSet }) => <DeckCard set={item} onOpen={openDeck} />,
    [openDeck],
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search decks…" />
          </View>
          <PressableScale
            style={styles.importButton}
            onPress={importCards}
            accessibilityLabel="Import flashcards from Anki or CSV"
          >
            <Upload size={18} color={Colors.primary} />
          </PressableScale>
        </View>
        {offlineSince !== null && (
          <InfoBanner icon={WifiOff} text={`Offline — showing cards saved on this device (last synced ${offlineSince}).`} />
        )}
      </View>

      {totalDue > 0 && (
        <PressableScale
          onPress={() => router.push('/study/flashcards/review')}
          style={styles.reviewBannerWrap}
        >
          <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reviewBanner}>
            <Zap size={16} color={Colors.primaryForeground} />
            <Text style={styles.reviewBannerText}>{totalDue} card{totalDue === 1 ? '' : 's'} due — start review</Text>
          </LinearGradient>
        </PressableScale>
      )}

      {leechCount > 0 && (
        <PressableScale
          onPress={() => router.push('/study/flashcards/leeches')}
          style={styles.leechBanner}
        >
          <Bug size={15} color={Colors.red} />
          <Text style={styles.leechBannerText}>
            {leechCount} card{leechCount === 1 ? '' : 's'} you keep forgetting — review leeches
          </Text>
          <ChevronRight size={16} color={Colors.red} />
        </PressableScale>
      )}

      {sets.length === 0 ? (
        <EmptyState icon={Layers} title="No flashcards yet" subtitle="Generate flashcards from a document or video on the web to see them here." />
      ) : (
        <FlatList
          data={sets}
          keyExtractor={(set) => set.key}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
          renderItem={renderDeck}
        />
      )}
    </View>
  );
}

// `onOpen` takes the key rather than closing over it, so the whole prop set stays
// reference-stable and the memo survives a parent re-render (e.g. typing in the search box).
const DeckCard: React.FC<{ set: FlashcardSet; onOpen: (key: string) => void }> = React.memo(
  function DeckCard({ set, onOpen }) {
    return (
      <PressableScale style={styles.card} onPress={() => onOpen(set.key)}>
        <IconBadge icon={Layers} color={Colors.amber} size={40} iconSize={18} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{set.name}</Text>
          <Text style={styles.cardSubtitle}>{set.count} card{set.count === 1 ? '' : 's'}</Text>
        </View>
        {set.dueCount > 0 ? (
          <View style={styles.dueBadge}>
            <Text style={styles.dueBadgeText}>{set.dueCount} due</Text>
          </View>
        ) : (
          <ChevronRight size={18} color={Colors.textSecondary} />
        )}
      </PressableScale>
    );
  },
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  header: { padding: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  searchRow: { ...Layout.row, gap: Spacing.two },
  searchWrap: { flex: 1 },
  importButton: {
    width: 46, height: 46, borderRadius: Radius.pill, backgroundColor: Colors.bgSidebar,
    ...Layout.center, ...Shadows.card,
  },
  reviewBannerWrap: { marginHorizontal: Spacing.three, marginBottom: Spacing.two, ...Shadows.primaryGlow },
  reviewBanner: {
    ...Layout.row, justifyContent: 'center', gap: Spacing.two,
    borderRadius: Radius.pill, paddingVertical: 12,
  },
  reviewBannerText: { ...Typography.bodyBold, color: Colors.primaryForeground },
  leechBanner: {
    ...Layout.row, gap: Spacing.two,
    marginHorizontal: Spacing.three, marginBottom: Spacing.two,
    backgroundColor: `${Colors.red}${Alpha.tint}`, borderRadius: Radius.pill,
    paddingVertical: 10, paddingHorizontal: Spacing.three,
  },
  leechBannerText: { ...Typography.captionBold, color: Colors.red, flex: 1 },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  card: {
    ...Layout.row, gap: Spacing.three,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three,
    ...Shadows.card,
  },
  cardBody: { flex: 1 },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  cardSubtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  dueBadge: { backgroundColor: `${Colors.amber}${Alpha.tint}`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  dueBadgeText: { ...Typography.captionBold, color: Colors.amber },
});
