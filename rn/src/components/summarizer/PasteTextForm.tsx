import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { documentService } from '@/services/documentService';

const MIN_LENGTH = 20;
const MAX_LENGTH = 500_000;

interface PasteTextFormProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

export function PasteTextForm({ selectedCourseId, onCourseError }: PasteTextFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_LENGTH) {
      setError(`Paste at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError('That text is too long.');
      return;
    }
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setError('');
    setUploading(true);
    try {
      const fileName = `${title.trim() || `Pasted Note ${new Date().toLocaleDateString()}`}.txt`;
      const file = new File(Paths.cache, fileName);
      if (file.exists) file.delete();
      file.create();
      file.write(trimmed);
      const doc = await documentService.uploadDocument(selectedCourseId, {
        uri: file.uri,
        name: fileName,
        mimeType: 'text/plain',
      });
      router.push(`/(tabs)/library/document/${doc.id}?courseId=${doc.courseId}`);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.root}>
      <TextField
        value={title}
        onChangeText={setTitle}
        placeholder="Title (optional)"
        autoCapitalize="sentences"
        autoCorrect
        style={styles.titleInput}
      />
      <TextInput
        value={text}
        onChangeText={(v) => { setText(v); setError(''); }}
        placeholder="Paste your notes, lecture transcript, or any text here…"
        placeholderTextColor={Colors.textSecondary}
        multiline
        textAlignVertical="top"
        style={styles.textArea}
      />
      <Text style={styles.counter}>{text.trim().length.toLocaleString()} characters</Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button title="Analyze Text" onPress={submit} loading={uploading} disabled={text.trim().length < MIN_LENGTH} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  titleInput: { height: 44, backgroundColor: Colors.bgSidebar },
  textArea: {
    minHeight: 180, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.three, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.bgSidebar,
  },
  counter: { fontSize: 11, color: Colors.textSecondary, textAlign: 'right' },
  error: { fontSize: 13, color: Colors.red },
});
