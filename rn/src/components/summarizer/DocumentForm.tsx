import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, FileText, Upload } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Dropzone } from '@/components/summarizer/Dropzone';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { documentService } from '@/services/documentService';
import { isAcceptedDocumentFile } from '@/constants/documentUpload';
import type { PickedFile } from '@/types';

interface DocumentFormProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

export function DocumentForm({ selectedCourseId, onCourseError }: DocumentFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickFile = async () => {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!isAcceptedDocumentFile(asset.name, asset.mimeType)) {
      setError('That file type isn’t supported.');
      return;
    }
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' });
  };

  // Photograph a textbook page or handwritten notes — the backend's AI OCR
  // fallback turns the image into a summarizable document like any other upload.
  const scanWithCamera = async () => {
    setError('');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Camera access is disabled for this app. Enable it in system Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.fileName ?? `scan-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const upload = async () => {
    if (!file) return;
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setError('');
    setUploading(true);
    try {
      const doc = await documentService.uploadDocument(selectedCourseId, file);
      router.push(`/(tabs)/library/document/${doc.id}?courseId=${doc.courseId}`);
      // Clear the form so returning to the summarizer starts fresh.
      setFile(null);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Dropzone
        icon={Upload}
        title={file ? file.name : 'Choose a document'}
        subtitle="PDF, Word, PowerPoint, text, code, images, and more"
        onPress={pickFile}
      />

      <Dropzone
        icon={Camera}
        title="Scan with camera"
        subtitle="Photograph a textbook page or handwritten notes"
        onPress={scanWithCamera}
      />

      {file && (
        <View style={styles.filePreview}>
          <FileText size={16} color={Colors.primary} />
          <Text style={styles.filePreviewText} numberOfLines={1}>{file.name}</Text>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button title="Upload & Analyze" onPress={upload} loading={uploading} disabled={!file} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  filePreview: {
    ...Layout.row, gap: Spacing.two,
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.two,
  },
  filePreviewText: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  error: { fontSize: 13, color: Colors.red },
});
