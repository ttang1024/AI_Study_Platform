import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, X } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { courseService } from '@/services/courseService';
import { studyGroupService, type SharedCourse } from '@/services/studyGroupService';
import type { Course } from '@/types';

interface SharedCoursesTabProps {
  groupId: string;
  sharedCourses: SharedCourse[];
  onChange: (sharedCourses: SharedCourse[]) => void;
}

export const SharedCoursesTab: React.FC<SharedCoursesTabProps> = ({ groupId, sharedCourses, onChange }) => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [pickerCourseId, setPickerCourseId] = useState<string | undefined>(undefined);
  const [sharing, setSharing] = useState(false);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);

  useEffect(() => {
    courseService.getCourses().then(setCourses).catch(() => {});
  }, []);

  const unsharedCourses = courses.filter((c) => !sharedCourses.some((sc) => sc.courseId === c.id));

  const handleShare = async () => {
    if (!pickerCourseId) return;
    setSharing(true);
    try {
      const shared = await studyGroupService.shareCourse(groupId, pickerCourseId);
      onChange([...sharedCourses, shared]);
      setPickerCourseId(undefined);
    } finally {
      setSharing(false);
    }
  };

  const handleUnshare = async (courseId: string) => {
    setRemovingCourseId(courseId);
    try {
      await studyGroupService.unshareCourse(groupId, courseId);
      onChange(sharedCourses.filter((sc) => sc.courseId !== courseId));
    } finally {
      setRemovingCourseId(null);
    }
  };

  return (
    <View style={styles.root}>
      {unsharedCourses.length > 0 && (
        <Card style={styles.form}>
          <Text style={styles.formLabel}>Share a course</Text>
          <View style={styles.chipRow}>
            {unsharedCourses.map((c) => (
              <FilterChip key={c.id} label={c.name} active={pickerCourseId === c.id} onPress={() => setPickerCourseId(c.id)} />
            ))}
          </View>
          <Pressable
            style={[styles.shareButton, (!pickerCourseId || sharing) && styles.shareButtonDisabled]}
            onPress={handleShare}
            disabled={!pickerCourseId || sharing}
          >
            {sharing ? (
              <ActivityIndicator color={Colors.primaryForeground} />
            ) : (
              <Text style={styles.shareButtonText}>Share with group</Text>
            )}
          </Pressable>
        </Card>
      )}

      {sharedCourses.length === 0 ? (
        <EmptyState icon={BookOpen} title="No shared courses yet" subtitle="Share a course to make it available to the whole group." />
      ) : (
        sharedCourses.map((sc) => (
          <Card key={sc.courseId} style={styles.row}>
            <BookOpen size={16} color={Colors.textSecondary} />
            <Text style={styles.courseName}>{sc.courseName}</Text>
            {sc.sharedByUserId === user?.id && (
              <Pressable onPress={() => handleUnshare(sc.courseId)} disabled={removingCourseId === sc.courseId} hitSlop={8}>
                {removingCourseId === sc.courseId ? (
                  <ActivityIndicator size="small" color={Colors.textSecondary} />
                ) : (
                  <X size={16} color={Colors.textSecondary} />
                )}
              </Pressable>
            )}
          </Card>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { padding: Spacing.three, gap: Spacing.two },
  form: { gap: Spacing.two },
  formLabel: { ...Typography.captionBold, color: Colors.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  shareButton: {
    height: 40, borderRadius: 8, backgroundColor: Colors.primary, ...Layout.center,
  },
  shareButtonDisabled: { opacity: 0.5 },
  shareButtonText: { ...Typography.captionBold, color: Colors.primaryForeground },
  row: { ...Layout.row, gap: Spacing.two },
  courseName: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
});
