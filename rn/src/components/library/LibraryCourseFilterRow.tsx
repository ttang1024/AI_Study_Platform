import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { PressableScale } from '@/components/PressableScale';
import { Colors, Layout, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import type { Course } from '@/types';

// Fixed pixel height for the same reason as FilterChip's CHIP_HEIGHT: the
// horizontal ScrollView needs an exact matching height or chip labels can
// measure at 0 height and render clipped.
const COURSE_CHIP_HEIGHT = 30;

interface Props {
  courses: Course[];
  activeCourseId: string | null;
  onToggleCourse: (courseId: string | null) => void;
}

export function LibraryCourseFilterRow({ courses, activeCourseId, onToggleCourse }: Props) {
  const router = useRouter();
  if (courses.length === 0) return null;

  return (
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
          <PressableScale
            key={course.id}
            style={[styles.courseChip, active && { borderColor: color }]}
            onPress={() => onToggleCourse(active ? null : course.id)}
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
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Same fixed-height + flexShrink-0 treatment as the type-filter row: the
  // horizontal ScrollView needs an exact height or it collapses chip text.
  courseScroll: { flexGrow: 0, flexShrink: 0, height: COURSE_CHIP_HEIGHT + Spacing.two },
  courseRow: {
    ...Layout.row, gap: Spacing.two,
    paddingHorizontal: Spacing.three, paddingBottom: Spacing.two,
  },
  courseChip: {
    ...Layout.row, gap: 6, maxWidth: 200,
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
});
