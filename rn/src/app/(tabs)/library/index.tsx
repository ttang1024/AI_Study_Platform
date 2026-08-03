import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import LibraryIcon from 'lucide-react-native/icons/library';

import { EmptyState } from '@/components/EmptyState';
import { CHIP_HEIGHT, FilterChip } from '@/components/FilterChip';
import { SearchBar } from '@/components/SearchBar';
import { LibraryCourseFilterRow } from '@/components/library/LibraryCourseFilterRow';
import { LibraryAssignSheet } from '@/components/library/LibraryAssignSheet';
import { LibraryEntryRow } from '@/components/library/LibraryEntryRow';
import { LibrarySelectionBar } from '@/components/library/LibrarySelectionBar';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { entryKey, TYPE_FILTERS, useLibraryList } from '@/hooks/useLibraryList';

export default function LibraryScreen() {
  const lib = useLibraryList();

  return (
    <View style={styles.root}>
      <View style={styles.searchBarWrap}>
        <SearchBar value={lib.search} onChangeText={lib.setSearch} placeholder="Search your library…" />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {TYPE_FILTERS.map((item) => (
          <FilterChip key={item.id} label={item.label} active={lib.activeType === item.id} onPress={() => lib.setActiveType(item.id)} />
        ))}
      </ScrollView>

      <LibraryCourseFilterRow
        courses={lib.courses}
        activeCourseId={lib.activeCourseId}
        onToggleCourse={lib.setActiveCourseId}
      />

      {/* Collections first, then tags — collections are the coarse grouping people organise by,
          and tags are the cross-cutting labels applied on top. `getTags` already returns them
          name-sorted within each kind, so only the kind split is needed here. */}
      {lib.tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {[...lib.tags].sort((a, b) => Number(a.kind === 'tag') - Number(b.kind === 'tag')).map((tag) => (
            <FilterChip
              key={tag.libraryTagId}
              label={`${tag.name} ${tag.itemCount}`}
              active={lib.selectedTagIds.includes(tag.libraryTagId)}
              onPress={() => lib.toggleTag(tag.libraryTagId)}
            />
          ))}
        </ScrollView>
      )}

      {lib.loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : lib.items.length === 0 ? (
        <EmptyState icon={LibraryIcon} title="No items yet" subtitle="Content you add on the web will show up here." />
      ) : (
        <FlatList
          data={lib.items}
          keyExtractor={(entry) => `${entry.kind}-${entry.data.id}`}
          contentContainerStyle={[styles.list, lib.selection.size > 0 && styles.listWithBar]}
          onEndReachedThreshold={0.4}
          onEndReached={lib.onEndReached}
          refreshControl={<RefreshControl refreshing={lib.refreshing} onRefresh={lib.refresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            <Text style={styles.resultCount}>{lib.totalCount} {lib.totalCount === 1 ? 'item' : 'items'}</Text>
          }
          ListFooterComponent={lib.loadingMore ? <ActivityIndicator style={styles.footerLoading} color={Colors.primary} /> : null}
          renderItem={({ item, index }) => (
            <LibraryEntryRow
              entry={item}
              onPress={lib.openEntry}
              onDelete={lib.deleteEntry}
              index={index}
              onToggleSelect={lib.toggleSelected}
              selectionMode={lib.selection.size > 0}
              selected={lib.selection.has(entryKey(item))}
            />
          )}
        />
      )}

      {/* Long-press a row to start picking items, then file them into a collection. */}
      <LibrarySelectionBar
        count={lib.selection.size}
        onAssign={() => lib.setAssignVisible(true)}
        onClear={lib.clearSelection}
      />

      <LibraryAssignSheet
        visible={lib.assignVisible}
        onClose={() => lib.setAssignVisible(false)}
        selection={[...lib.selection.values()]}
        onChanged={lib.handleAssigned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  searchBarWrap: { marginHorizontal: Spacing.three, marginTop: Spacing.three },
  // Vertical padding leaves room for the active chip's glow shadow; the fixed
  // height keeps the horizontal ScrollView from collapsing chip text (see
  // FilterChip's CHIP_HEIGHT note). flexShrink 0 because ScrollView's base
  // style has flexShrink 1 — when the FlatList below holds enough rows to
  // overflow the screen, yoga would compress these fixed-height chip rows.
  filterScroll: { flexGrow: 0, flexShrink: 0, height: CHIP_HEIGHT + Spacing.three * 2 },
  filterRow: {
    ...Layout.row,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: Spacing.two,
  },
  resultCount: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  loading: { marginTop: Spacing.five },
  footerLoading: { marginVertical: Spacing.three },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: 12 },
  // Clears the floating selection bar so the last row stays reachable.
  listWithBar: { paddingBottom: Spacing.five * 2 },
});
