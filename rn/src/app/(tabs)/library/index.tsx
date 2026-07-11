import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronRight, Library as LibraryIcon } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { CHIP_HEIGHT, FilterChip } from '@/components/FilterChip';
import { SearchBar } from '@/components/SearchBar';
import { LibraryEntryRow } from '@/components/library/LibraryEntryRow';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { courseService } from '@/services/courseService';
import { libraryService, LibraryEntry, LibraryFilterType } from '@/services/libraryService';
import type { Course } from '@/types';

const PAGE_SIZE = 20;

// Fixed pixel height for the same reason as FilterChip's CHIP_HEIGHT: the
// horizontal ScrollView needs an exact matching height or chip labels can
// measure at 0 height and render clipped.
const COURSE_CHIP_HEIGHT = 30;

const TYPE_FILTERS: { id: LibraryFilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'documents', label: 'Documents' },
  { id: 'videos', label: 'Videos' },
  { id: 'articles', label: 'Articles' },
  { id: 'audio', label: 'Audio' },
];

const isFilterType = (value: string | undefined): value is LibraryFilterType =>
  !!value && TYPE_FILTERS.some((filter) => filter.id === value);

export default function LibraryScreen() {
  const router = useRouter();
  const { q, type } = useLocalSearchParams<{ q?: string; type?: string }>();
  const [activeType, setActiveType] = useState<LibraryFilterType>(isFilterType(type) ? type : 'all');
  const [search, setSearch] = useState(q ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(q ?? '');
  const [items, setItems] = useState<LibraryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  useEffect(() => {
    courseService.getCourses().then(setCourses).catch(() => {});
  }, []);

  useEffect(() => {
    if (isFilterType(type)) setActiveType(type);
  }, [type]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const requestRef = useRef(0);
  const fetchPage = useCallback(async (targetPage: number, replace: boolean) => {
    const requestId = ++requestRef.current;
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const data = await libraryService.getLibrary({
        type: activeType,
        courseId: activeCourseId ?? undefined,
        search: debouncedSearch,
        page: targetPage,
        pageSize: PAGE_SIZE,
      });
      if (requestRef.current !== requestId) return;
      setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
      setTotalCount(data.totalCount);
      setPage(targetPage);
    } catch {
      if (requestRef.current !== requestId) return;
      if (replace) {
        setItems([]);
        setTotalCount(0);
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeType, activeCourseId, debouncedSearch]);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || items.length >= totalCount) return;
    fetchPage(page + 1, false);
  }, [loading, loadingMore, items.length, totalCount, fetchPage, page]);

  const openEntry = useCallback((entry: LibraryEntry) => {
    if (entry.kind === 'document') router.push(`/(tabs)/library/document/${entry.data.id}?courseId=${entry.data.courseId}`);
    else router.push(`/(tabs)/library/video/${entry.data.id}`);
  }, [router]);

  return (
    <View style={styles.root}>
      <View style={styles.searchBarWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search your library…" />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {TYPE_FILTERS.map((item) => (
          <FilterChip key={item.id} label={item.label} active={activeType === item.id} onPress={() => setActiveType(item.id)} />
        ))}
      </ScrollView>

      {courses.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.courseScroll}
          contentContainerStyle={styles.courseRow}
        >
          {courses.map((course) => {
            const active = course.id === activeCourseId;
            const color = course.color || Colors.primary;
            const openCourse = () => router.push({
              pathname: '/(tabs)/library/course/[id]',
              params: { id: course.id, name: course.name, color: course.color },
            });
            return (
              <Pressable
                key={course.id}
                style={({ pressed }) => [
                  styles.courseChip,
                  active && { borderColor: color },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => setActiveCourseId(active ? null : course.id)}
                onLongPress={openCourse}
              >
                <View style={[styles.courseDot, { backgroundColor: color }]} />
                <Text
                  style={[styles.courseChipText, active && { color }]}
                  numberOfLines={1}
                >
                  {course.name}
                </Text>
                {active && (
                  <Pressable onPress={openCourse} hitSlop={8} style={styles.courseOpenBtn}>
                    <ChevronRight size={14} color={color} />
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : items.length === 0 ? (
        <EmptyState icon={LibraryIcon} title="No items yet" subtitle="Content you add on the web will show up here." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(entry) => `${entry.kind}-${entry.data.id}`}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          ListHeaderComponent={
            <Text style={styles.resultCount}>{totalCount} {totalCount === 1 ? 'item' : 'items'}</Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoading} color={Colors.primary} /> : null}
          renderItem={({ item }) => <LibraryEntryRow entry={item} onPress={openEntry} />}
        />
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: Spacing.two,
  },
  resultCount: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  // Same fixed-height + flexShrink-0 treatment as filterScroll (see note there).
  courseScroll: { flexGrow: 0, flexShrink: 0, height: COURSE_CHIP_HEIGHT + Spacing.two },
  courseRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingHorizontal: Spacing.three, paddingBottom: Spacing.two,
  },
  courseChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200,
    height: COURSE_CHIP_HEIGHT,
    backgroundColor: Colors.bgCard, borderRadius: Radius.pill,
    paddingHorizontal: 12, ...Shadows.card,
    // Constant border width in both states (only the color changes) so
    // toggling a chip never shifts its neighbors — same trick as FilterChip.
    borderWidth: 1, borderColor: 'transparent',
  },
  courseDot: { width: 8, height: 8, borderRadius: 4 },
  // Negative right margin pulls the chevron toward the pill edge so the
  // active chip doesn't read wider than the 12px text padding suggests.
  courseOpenBtn: { marginRight: -6 },
  courseChipText: { ...Typography.captionBold, lineHeight: 16, color: Colors.textPrimary },
  loading: { marginTop: Spacing.five },
  footerLoading: { marginVertical: Spacing.three },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: 12 },
});
