import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Newspaper } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { DuplicateAlert } from '@/components/summarizer/DuplicateAlert';
import { IntroCard } from '@/components/summarizer/IntroCard';
import { TextField } from '@/components/TextField';
import { Colors, Spacing } from '@/constants/theme';
import { documentService } from '@/services/documentService';
import { useLibraryEntries } from '@/hooks/useLibraryEntries';
import { getApiErrorMessage } from '@/utils/apiError';

interface WebArticleFormProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

export function WebArticleForm({ selectedCourseId, onCourseError }: WebArticleFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const articles = useLibraryEntries('articles');

  const trimmedUrl = url.trim();
  const duplicate = trimmedUrl
    ? articles.find((e) => e.kind === 'document' && e.data.originalUrl === trimmedUrl)
    : undefined;

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    // Don't clip an article that's already in the library — the duplicate banner is shown instead.
    if (duplicate) return;
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setError('');
    setLoading(true);
    try {
      const result = await documentService.clipUrl(trimmed, selectedCourseId);
      router.push(`/(tabs)/library/document/${result.documentId}?courseId=${result.courseId}`);
      // Clear the form so returning to the summarizer starts fresh.
      setUrl('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not read that page. Please check the URL and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <IntroCard
        icon={Newspaper}
        title="Turn any web article into study material"
        subtitle="Paste the link to a blog post, news article, or documentation page."
      >
        <TextField
          value={url}
          onChangeText={(v) => { setUrl(v); setError(''); }}
          placeholder="https://example.com/article"
          keyboardType="url"
          style={styles.input}
        />
      </IntroCard>

      {duplicate?.kind === 'document' && (
        <DuplicateAlert
          label="article"
          courseName={duplicate.data.courseName ?? ''}
          onView={() => router.push(`/(tabs)/library/document/${duplicate.data.id}?courseId=${duplicate.data.courseId}`)}
        />
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button title="Clip & Analyze" onPress={submit} loading={loading} disabled={!url.trim() || !!duplicate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  input: { width: '100%', height: 44, backgroundColor: Colors.bgApp },
  error: { fontSize: 13, color: Colors.red },
});
