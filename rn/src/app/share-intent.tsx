import { File, Paths } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import FileTextIcon from 'lucide-react-native/icons/file-text';
import Link2 from 'lucide-react-native/icons/link-2';

import { Button } from '@/components/Button';
import { CourseChipPicker } from '@/components/summarizer/CourseChipPicker';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { courseService } from '@/services/courseService';
import { documentService } from '@/services/documentService';
import { getApiErrorMessage } from '@/utils/apiError';
import type { Course } from '@/types';

/**
 * Landing screen for content shared into the app from the iOS/Android share sheet
 * (a web link or selected text). Routed here from the root layout whenever
 * `expo-share-intent` reports a pending intent. Reuses the same clip/paste
 * endpoints as the in-app summarizer tabs.
 */
export default function ShareIntentScreen() {
  const router = useRouter();
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseError, setCourseError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    courseService.getCourses().then(setCourses).catch(() => setCourses([]));
  }, []);

  const isUrl = shareIntent.type === 'weburl' && !!shareIntent.webUrl;
  const sharedText = shareIntent.text ?? '';
  const previewTitle = isUrl ? shareIntent.webUrl! : shareIntent.meta?.title || 'Shared text';

  const submit = async () => {
    if (!selectedCourseId) { setCourseError(true); return; }
    setCourseError(false);
    setError('');
    setSubmitting(true);
    try {
      if (isUrl) {
        const result = await documentService.clipUrl(shareIntent.webUrl!, selectedCourseId);
        resetShareIntent();
        router.replace(`/(tabs)/library/document/${result.documentId}?courseId=${result.courseId}`);
      } else {
        const fileName = `Shared Text ${new Date().toLocaleDateString()}.txt`;
        const file = new File(Paths.cache, fileName);
        if (file.exists) file.delete();
        file.create();
        file.write(sharedText);
        const doc = await documentService.uploadDocument(selectedCourseId, {
          uri: file.uri,
          name: fileName,
          mimeType: 'text/plain',
        });
        resetShareIntent();
        router.replace(`/(tabs)/library/document/${doc.id}?courseId=${doc.courseId}`);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save that. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = () => {
    resetShareIntent();
    router.replace('/(tabs)');
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Save to toto.ai',
          headerLeft: () => (
            <Pressable onPress={cancel} hitSlop={8}>
              <ChevronLeft size={24} color={Colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.previewCard}>
          {isUrl ? <Link2 size={18} color={Colors.primary} /> : <FileTextIcon size={18} color={Colors.primary} />}
          <Text style={styles.previewText} numberOfLines={3}>{previewTitle}</Text>
        </View>
        {!isUrl && !!sharedText && (
          <Text style={styles.snippet} numberOfLines={4}>{sharedText}</Text>
        )}

        <CourseChipPicker
          courses={courses}
          selectedCourseId={selectedCourseId}
          onSelect={(id) => { setSelectedCourseId(id); setCourseError(false); }}
          error={courseError}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          title={isUrl ? 'Clip & Analyze' : 'Save & Analyze'}
          onPress={submit}
          loading={submitting}
          disabled={!isUrl && !sharedText.trim()}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three },
  previewCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two,
    padding: Spacing.three, borderRadius: Radius.lg,
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
  },
  previewText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  snippet: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  error: { fontSize: 13, color: Colors.red },
});
