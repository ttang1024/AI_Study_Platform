import { StyleSheet, Text, View } from 'react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { CourseArtifactsPane } from '@/components/library/CourseArtifactsPane';
import { CourseMaterialsList } from '@/components/library/CourseMaterialsList';
import type { Mode } from '@/components/library/courseWorkspace';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useCourseWorkspace } from '@/hooks/useCourseWorkspace';

/**
 * Mobile port of web's CourseStudyPage. The web page is a three-pane desktop
 * workspace (materials sidebar + embedded detail + artifacts view); on a phone
 * the same jobs split into two tabs — Materials (list, studied check-offs,
 * push-navigation instead of an embedded pane) and Artifacts (course-wide
 * aggregation of notes/flashcards/questions/glossary, same filtering rules).
 */
export default function CourseWorkspaceScreen() {
  const c = useCourseWorkspace();

  if (c.entries === null) return <LoadingScreen />;

  return (
    <View style={styles.root}>
      <View style={[styles.courseBanner, { borderLeftColor: c.accent }]}>
        <Text style={styles.courseName} numberOfLines={1}>{c.name ?? 'Course'}</Text>
        <Text style={styles.courseCounts}>
          {c.docCount} doc{c.docCount === 1 ? '' : 's'} · {c.videoCount} video{c.videoCount === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.tabsWrap}>
        <SegmentedTabs<Mode>
          options={[{ value: 'materials', label: 'Materials' }, { value: 'artifacts', label: 'Artifacts' }]}
          value={c.mode}
          onChange={c.setMode}
        />
      </View>

      {c.mode === 'materials' ? (
        <CourseMaterialsList
          entries={c.filteredEntries}
          search={c.search}
          onChangeSearch={c.setSearch}
          studiedIds={c.studiedIds}
          onToggleStudied={c.toggleStudied}
          onOpenEntry={c.openEntry}
        />
      ) : (
        <CourseArtifactsPane artifacts={c.artifacts} active={c.activeArtifact} onChangeActive={c.setActiveArtifact} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  courseBanner: {
    marginHorizontal: Spacing.three, marginTop: Spacing.three, padding: Spacing.three,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderLeftWidth: 4, ...Shadows.card,
  },
  courseName: { ...Typography.bodyBold, color: Colors.textPrimary },
  courseCounts: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  tabsWrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
});
