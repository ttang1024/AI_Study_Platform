import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClipboardPaste, FileText, Headphones, Newspaper, Video } from 'lucide-react-native';

import { TabChipRow } from '@/components/TabChipRow';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { courseService } from '@/services/courseService';
import type { Course } from '@/types';
import { DocumentForm } from '@/components/summarizer/DocumentForm';
import { VideoForm } from '@/components/summarizer/VideoForm';
import { WebArticleForm } from '@/components/summarizer/WebArticleForm';
import { AudioForm } from '@/components/summarizer/AudioForm';
import { PasteTextForm } from '@/components/summarizer/PasteTextForm';

type Tab = 'document' | 'video' | 'web' | 'audio' | 'text';

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'web', label: 'Web', icon: Newspaper },
  { id: 'audio', label: 'Audio', icon: Headphones },
  { id: 'text', label: 'Text', icon: ClipboardPaste },
];

export default function SummarizerScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseError, setCourseError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('document');

  useEffect(() => {
    courseService.getCourses().then(setCourses).catch(() => setCourses([]));
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setCourseError(false);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Turn anything into study material</Text>

      <Text style={[styles.sectionLabel, courseError && styles.sectionLabelError]}>
        {courseError ? 'Choose a course first' : 'Course'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseRow}>
        {courses.map((course) => (
          <Pressable
            key={course.id}
            onPress={() => { setSelectedCourseId(course.id); setCourseError(false); }}
            style={[
              styles.courseChip,
              selectedCourseId === course.id && { backgroundColor: course.color, borderColor: course.color },
              courseError && !selectedCourseId && styles.courseChipError,
            ]}
          >
            <View style={[styles.courseDot, { backgroundColor: course.color }]} />
            <Text style={[styles.courseChipText, selectedCourseId === course.id && styles.courseChipTextActive]} numberOfLines={1}>
              {course.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <TabChipRow tabs={TABS} active={activeTab} onChange={handleTabChange} />

      <View style={styles.formArea}>
        {activeTab === 'document' && <DocumentForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
        {activeTab === 'video' && <VideoForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
        {activeTab === 'web' && <WebArticleForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
        {activeTab === 'audio' && <AudioForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
        {activeTab === 'text' && <PasteTextForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.two },
  heading: { ...Typography.screenTitle, color: Colors.textPrimary, marginBottom: Spacing.two },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.textSecondary },
  sectionLabelError: { color: Colors.red },
  courseRow: { gap: Spacing.two, paddingVertical: Spacing.one, marginBottom: Spacing.two },
  courseChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgSidebar, maxWidth: 160,
  },
  courseChipError: { borderColor: Colors.red },
  courseDot: { width: 8, height: 8, borderRadius: 4 },
  courseChipText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  courseChipTextActive: { color: Colors.primaryForeground },
  formArea: { marginTop: Spacing.one },
});
