import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Plus from 'lucide-react-native/icons/plus';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import type { Course } from '@/types';

interface CourseChipPickerProps {
  courses: Course[];
  selectedCourseId: string;
  onSelect: (courseId: string) => void;
  error?: boolean;
  label?: string;
  /** When provided, renders a trailing "+ New" chip that opens the create flow. */
  onAddCourse?: () => void;
  /** When provided, long-pressing a chip invokes this (used to edit/delete). */
  onManageCourse?: (course: Course) => void;
}

/** The horizontal course-chip row shared by the summarizer tab and the share-sheet intake screen. */
export function CourseChipPicker({
  courses,
  selectedCourseId,
  onSelect,
  error,
  label = 'Course',
  onAddCourse,
  onManageCourse,
}: CourseChipPickerProps) {
  return (
    <View>
      <Text style={[styles.sectionLabel, error && styles.sectionLabelError]}>
        {error ? 'Choose a course first' : onManageCourse ? `${label} · long-press to edit` : label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseRow}>
        {courses.map((course) => (
          <Pressable
            key={course.id}
            onPress={() => onSelect(course.id)}
            onLongPress={onManageCourse ? () => onManageCourse(course) : undefined}
            style={[
              styles.courseChip,
              selectedCourseId === course.id && { backgroundColor: course.color, borderColor: course.color },
              error && !selectedCourseId && styles.courseChipError,
            ]}
          >
            <View style={[styles.courseDot, { backgroundColor: course.color }]} />
            <Text style={[styles.courseChipText, selectedCourseId === course.id && styles.courseChipTextActive]} numberOfLines={1}>
              {course.name}
            </Text>
          </Pressable>
        ))}
        {onAddCourse && (
          <Pressable onPress={onAddCourse} style={[styles.courseChip, styles.addChip]}>
            <Plus size={14} color={Colors.primary} />
            <Text style={[styles.courseChipText, styles.addChipText]}>New</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.textSecondary },
  sectionLabelError: { color: Colors.red },
  courseRow: { gap: Spacing.two, paddingVertical: Spacing.one },
  courseChip: {
    ...Layout.row, gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgSidebar, maxWidth: 160,
  },
  courseChipError: { borderColor: Colors.red },
  addChip: { borderStyle: 'dashed', borderColor: Colors.primary, backgroundColor: Colors.bgApp },
  addChipText: { color: Colors.primary },
  courseDot: { width: 8, height: 8, borderRadius: 4 },
  courseChipText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  courseChipTextActive: { color: Colors.primaryForeground },
});
