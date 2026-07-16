import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClipboardPaste, FileText, Headphones, Newspaper, Video } from 'lucide-react-native';

import { TabChipRow } from '@/components/TabChipRow';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { courseService } from '@/services/courseService';
import type { Course } from '@/types';
import { CourseChipPicker } from '@/components/summarizer/CourseChipPicker';
import { CourseEditorModal } from '@/components/summarizer/CourseEditorModal';
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

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const loadCourses = () => courseService.getCourses().then(setCourses).catch(() => setCourses([]));

  useEffect(() => {
    loadCourses();
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setCourseError(false);
  };

  const openCreate = () => {
    setEditingCourse(null);
    setEditorVisible(true);
  };

  const handleSubmitCourse = async (data: { courseName: string; courseColor: string }) => {
    const saved = editingCourse
      ? await courseService.updateCourse(editingCourse.id, data)
      : await courseService.createCourse(data);
    await loadCourses();
    if (!editingCourse) setSelectedCourseId(saved.id);
  };

  const confirmDelete = (course: Course) => {
    Alert.alert(
      'Delete course',
      `Delete "${course.name}"? Any documents, videos, and audio in this course will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await courseService.deleteCourse(course.id);
              if (selectedCourseId === course.id) setSelectedCourseId('');
              await loadCourses();
            } catch {
              Alert.alert('Delete failed', 'Could not delete this course. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleManageCourse = (course: Course) => {
    Alert.alert(course.name, undefined, [
      { text: 'Edit', onPress: () => { setEditingCourse(course); setEditorVisible(true); } },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(course) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      // Without this, a tap on a button while the URL keyboard is open is swallowed
      // just to dismiss the keyboard, so submit/View actions need a second tap.
      keyboardShouldPersistTaps="handled"
      // The duplicate-link banner grows the form; without a keyboard inset the
      // "Analyze"/submit button ends up hidden behind the keyboard with no room to
      // scroll it into reach. This insets the scroll content by the keyboard height.
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <Text style={styles.heading}>Turn anything into study material</Text>

      <CourseChipPicker
        courses={courses}
        selectedCourseId={selectedCourseId}
        onSelect={(id) => { setSelectedCourseId(id); setCourseError(false); }}
        error={courseError}
        onAddCourse={openCreate}
        onManageCourse={handleManageCourse}
      />

      <TabChipRow tabs={TABS} active={activeTab} onChange={handleTabChange} />

      <View style={styles.formArea}>
        {activeTab === 'document' && <DocumentForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
        {activeTab === 'video' && <VideoForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
        {activeTab === 'web' && <WebArticleForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
        {activeTab === 'audio' && <AudioForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
        {activeTab === 'text' && <PasteTextForm selectedCourseId={selectedCourseId} onCourseError={setCourseError} />}
      </View>

      {editorVisible && (
        <CourseEditorModal
          key={editingCourse?.id ?? 'new'}
          course={editingCourse}
          onClose={() => setEditorVisible(false)}
          onSubmit={handleSubmitCourse}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.two },
  heading: { ...Typography.screenTitle, color: Colors.textPrimary, marginBottom: Spacing.two },
  formArea: { marginTop: Spacing.one },
});
