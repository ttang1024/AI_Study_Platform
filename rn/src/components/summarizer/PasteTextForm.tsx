import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { DuplicateAlert } from '@/components/summarizer/DuplicateAlert';
import { TextField } from '@/components/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { documentService } from '@/services/documentService';
import { useLibraryEntries } from '@/hooks/useLibraryEntries';
import { useSubmitLock } from '@/hooks/useSubmitLock';

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
  const [hashed, setHashed] = useState<{ text: string; hash: string } | null>(null);
  const documents = useLibraryEntries('documents');
  const runExclusive = useSubmitLock();

  const trimmed = text.trim();

  // The upload writes exactly this string to the .txt file, so its SHA-256 is the same hash the API
  // stores — an exact match for the same text pasted twice. Debounced: the box takes 500k characters
  // and re-hashing on every keystroke would be wasted work.
  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, trimmed)
        .then((hash) => { if (!cancelled) setHashed({ text: trimmed, hash }); })
        .catch(() => {
          // Duplicate detection is best-effort — a failed digest just means no hint.
        });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [trimmed]);

  // Only trust the digest while it still describes what's in the box — editing invalidates it
  // until the next one settles.
  const textHash = hashed?.text === trimmed ? hashed.hash : null;

  const duplicate = textHash
    ? documents.find((e) => e.kind === 'document' && e.data.fileHash === textHash)
    : undefined;

  const submit = async () => {
    // Already uploaded — the duplicate banner offers the way to it instead.
    if (duplicate) return;
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
      // Clear the form so returning to the summarizer starts fresh.
      setTitle('');
      setText('');
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

      {duplicate?.kind === 'document' && (
        <DuplicateAlert
          label="text"
          courseName={duplicate.data.courseName ?? ''}
          onView={() => router.push(`/(tabs)/library/document/${duplicate.data.id}?courseId=${duplicate.data.courseId}`)}
        />
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button
        title={duplicate ? 'Already in Library' : 'Analyze Text'}
        onPress={() => runExclusive(submit)}
        loading={uploading}
        disabled={trimmed.length < MIN_LENGTH || !!duplicate}
      />
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
