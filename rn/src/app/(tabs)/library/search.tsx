import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import SearchIcon from 'lucide-react-native/icons/search';
import Sparkles from 'lucide-react-native/icons/sparkles';

import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { SearchBar } from '@/components/SearchBar';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { searchService, AskLibraryAnswer, CitationType, SearchResultItem, SearchResultType } from '@/services/searchService';

const TYPE_FILTERS: { id: SearchResultType; label: string }[] = [
  { id: 'document', label: 'Documents' },
  { id: 'note', label: 'Notes' },
  { id: 'flashcard', label: 'Flashcards' },
  { id: 'glossary', label: 'Glossary' },
];

// Result items only carry an id/title/type — routing to the real document/video detail
// screens needs a courseId the search API doesn't return (see documentService — those routes
// are nested under /api/courses/{courseId}/...). Document hits go to Library prefilled with
// the title instead of guessing a courseId; note/flashcard/glossary have no per-item detail
// screen on web either, so they route to their list screens.
function routeFor(item: { type: CitationType; id: string; title: string }, router: ReturnType<typeof useRouter>) {
  switch (item.type) {
    case 'document':
      router.push({ pathname: '/library', params: { q: item.title } });
      return;
    case 'video':
      router.push({ pathname: '/library/video/[id]', params: { id: item.id } });
      return;
    case 'note':
      router.push('/study/notes');
      return;
    case 'flashcard':
      router.push('/study/flashcards');
      return;
    case 'glossary':
      router.push('/study/glossary');
      return;
  }
}

export default function SearchScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<SearchResultType>>(new Set());
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [askAnswer, setAskAnswer] = useState<AskLibraryAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const runSearch = async (q: string, types: Set<SearchResultType>, targetPage: number, replace: boolean) => {
    if (!q.trim()) return;
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await searchService.search(q.trim(), types.size ? Array.from(types) : undefined, targetPage);
      setItems((prev) => (replace ? result.items : [...prev, ...result.items]));
      setTotalCount(result.totalCount);
      setPage(targetPage);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSubmit = () => {
    const q = input.trim();
    if (!q) return;
    setQuery(q);
    setAskAnswer(null);
    setAskError(null);
    runSearch(q, activeTypes, 1, true);
  };

  const toggleType = (type: SearchResultType) => {
    const next = new Set(activeTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setActiveTypes(next);
    if (query) runSearch(query, next, 1, true);
  };

  const askAi = async () => {
    if (!query || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      setAskAnswer(await searchService.askLibrary(query));
    } catch {
      setAskError("Couldn't find an answer in your library for this question.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SearchBar
          value={input}
          onChangeText={setInput}
          placeholder="Search your library…"
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
        />
        <View style={styles.filterRow}>
          {TYPE_FILTERS.map((f) => (
            <FilterChip key={f.id} label={f.label} active={activeTypes.has(f.id)} onPress={() => toggleType(f.id)} />
          ))}
        </View>
      </View>

      {!query ? (
        <EmptyState icon={SearchIcon} title="Search your library" subtitle="Find documents, notes, flashcards, and glossary terms." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (loading || loadingMore || items.length >= totalCount) return;
            runSearch(query, activeTypes, page + 1, false);
          }}
          ListHeaderComponent={
            <View style={styles.askCard}>
              {askAnswer ? (
                <>
                  <View style={styles.askHeader}>
                    <Sparkles size={14} color={Colors.primary} />
                    <Text style={styles.askHeaderText}>AI Answer</Text>
                  </View>
                  <Text style={styles.askAnswerText}>{askAnswer.answer}</Text>
                  {askAnswer.citations.length > 0 && (
                    <View style={styles.citationRow}>
                      {askAnswer.citations.map((c) => (
                        <Pressable key={c.index} style={styles.citationChip} onPress={() => routeFor(c, router)}>
                          <Text style={styles.citationChipText}>[{c.index}] {c.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <Pressable style={styles.askButtonRow} onPress={askAi} disabled={asking}>
                  {asking ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Sparkles size={16} color={Colors.primary} />
                      <Text style={styles.askButtonText}>Ask AI: &quot;{query}&quot;</Text>
                    </>
                  )}
                </Pressable>
              )}
              {!!askError && <Text style={styles.askErrorText}>{askError}</Text>}
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loading} color={Colors.primary} />
            ) : (
              <EmptyState icon={SearchIcon} title="No results" subtitle={`Nothing matched "${query}".`} />
            )
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoading} color={Colors.primary} /> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.resultCard} onPress={() => routeFor(item, router)}>
              <Text style={styles.resultType}>{item.type}</Text>
              <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.resultSnippet} numberOfLines={2}>{item.snippet}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  header: { padding: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  loading: { marginTop: Spacing.five },
  footerLoading: { marginVertical: Spacing.three },
  askCard: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, marginBottom: Spacing.two,
  },
  askButtonRow: { ...Layout.row, gap: Spacing.two, justifyContent: 'center', paddingVertical: 4 },
  askButtonText: { ...Typography.bodyBold, color: Colors.primary },
  askHeader: { ...Layout.row, gap: 6 },
  askHeaderText: { ...Typography.captionBold, color: Colors.primary, textTransform: 'uppercase' },
  askAnswerText: { ...Typography.body, color: Colors.textPrimary },
  askErrorText: { ...Typography.caption, color: Colors.red },
  citationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  citationChip: { backgroundColor: Colors.bgApp, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  citationChipText: { ...Typography.caption, color: Colors.primary },
  resultCard: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three, gap: 4,
  },
  resultType: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
  resultTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  resultSnippet: { ...Typography.caption, color: Colors.textSecondary },
});
