import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { BookOpen, CheckCircle2, Circle } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { SearchBar } from '@/components/SearchBar';
import { LibraryEntryRow } from '@/components/library/LibraryEntryRow';
import { Colors, Layout, Spacing } from '@/constants/theme';
import type { LibraryEntry } from '@/services/libraryService';

interface Props {
  entries: LibraryEntry[];
  search: string;
  onChangeSearch: (v: string) => void;
  studiedIds: Set<string>;
  onToggleStudied: (id: string) => void;
  onOpenEntry: (entry: LibraryEntry) => void;
}

export function CourseMaterialsList({
  entries, search, onChangeSearch, studiedIds, onToggleStudied, onOpenEntry,
}: Props) {
  return (
    <>
      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={onChangeSearch} placeholder="Search materials…" />
      </View>
      {entries.length === 0 ? (
        <EmptyState icon={BookOpen} title="No materials" subtitle="Add documents or videos to this course on the web." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => `${e.kind}-${e.data.id}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const studied = studiedIds.has(item.data.id);
            return (
              <View style={[styles.materialRow, studied && styles.materialRowStudied]}>
                <View style={styles.materialRowEntry}>
                  <LibraryEntryRow entry={item} onPress={onOpenEntry} />
                </View>
                <Pressable
                  onPress={() => onToggleStudied(item.data.id)}
                  hitSlop={8}
                  accessibilityLabel={studied ? 'Mark as unread' : 'Mark as studied'}
                >
                  {studied
                    ? <CheckCircle2 size={20} color={Colors.emerald} />
                    : <Circle size={20} color={Colors.textSecondary} />}
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  searchWrap: { padding: Spacing.three, paddingBottom: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  materialRow: { ...Layout.row, gap: Spacing.two },
  materialRowStudied: { opacity: 0.55 },
  materialRowEntry: { flex: 1 },
});
