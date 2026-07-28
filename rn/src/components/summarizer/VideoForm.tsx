import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FileVideo from 'lucide-react-native/icons/file-play';
import LinkIcon from 'lucide-react-native/icons/link';
import Video from 'lucide-react-native/icons/video';

import { Button } from '@/components/Button';
import { DuplicateAlert } from '@/components/summarizer/DuplicateAlert';
import { Dropzone } from '@/components/summarizer/Dropzone';
import { IntroCard } from '@/components/summarizer/IntroCard';
import { SubTabChipRow } from '@/components/summarizer/SubTabChipRow';
import { TextField } from '@/components/TextField';
import { Colors, Spacing } from '@/constants/theme';
import { videoService } from '@/services/videoService';
import { detectVideoSource, parseUrlVideoId, URL_SOURCE_BRANDING } from '@/constants/videoSources';
import { useLibraryEntries } from '@/hooks/useLibraryEntries';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { getApiErrorMessage } from '@/utils/apiError';
import type { PickedFile } from '@/types';

interface VideoFormProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

type SubTab = 'link' | 'upload';

const SUB_TABS: { id: SubTab; label: string; icon: typeof LinkIcon }[] = [
  { id: 'link', label: 'Video Link', icon: LinkIcon },
  { id: 'upload', label: 'Upload Video', icon: FileVideo },
];

export function VideoForm({ selectedCourseId, onCourseError }: VideoFormProps) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>('link');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const videos = useLibraryEntries('videos');
  const runExclusive = useSubmitLock();

  // Reactively flag a pasted link that resolves to a video already in the library
  // (same source + video id), mirroring web's WebVideoTab duplicate hint.
  const trimmedUrl = url.trim();
  const detectedSource = trimmedUrl ? detectVideoSource(trimmedUrl) : null;
  const detectedVideoId = detectedSource ? parseUrlVideoId(detectedSource, trimmedUrl) : null;
  const duplicate = detectedSource && detectedVideoId
    ? videos.find((e) => e.kind === 'video' && e.data.videoId === detectedVideoId && (e.data.sourceType ?? 'youtube') === detectedSource)
    : undefined;

  // An uploaded video carries no file hash server-side — the upload stores the file name (minus its
  // extension) as the title, so that is the only signal a re-pick of the same file leaves behind.
  const pickedBaseName = file ? file.name.replace(/\.[^.]+$/, '').trim().toLowerCase() : null;
  const duplicateUpload = pickedBaseName
    ? videos.find((e) => e.kind === 'video' && e.data.sourceType === 'upload' && e.data.title.trim().toLowerCase() === pickedBaseName)
    : undefined;

  const submitLink = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    // Don't add a video that's already in the library — the duplicate banner is shown instead.
    if (duplicate) return;
    const source = detectVideoSource(trimmed);
    if (!source) {
      setError('Unrecognized video link. Supported sites: YouTube, Bilibili, Vimeo, TED, Dailymotion, TikTok, Facebook, Instagram, X, Reddit, LinkedIn.');
      return;
    }
    const videoId = parseUrlVideoId(source, trimmed);
    if (!videoId) {
      setError(`This looks like a ${URL_SOURCE_BRANDING[source].label} link, but no video could be identified in it.`);
      return;
    }
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setError('');
    setLoading(true);
    try {
      let title = `${URL_SOURCE_BRANDING[source].label} ${videoId}`;
      let thumbnailUrl = source === 'youtube' ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
      try {
        if (source === 'youtube') {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(trimmed)}&format=json`);
          const oembed = await oembedRes.json();
          title = oembed.title ?? title;
        } else if (source === 'bilibili') {
          const items = await videoService.getBilibiliItems(trimmed);
          const selectedItem = items.find((i) => i.videoId === videoId) ?? items[0];
          if (selectedItem) {
            title = selectedItem.title || title;
            thumbnailUrl = selectedItem.thumbnailUrl || thumbnailUrl;
          }
        } else {
          const meta = await videoService.getVideoMetadata(trimmed);
          if (meta?.title) title = meta.title;
          if (meta?.thumbnailUrl) thumbnailUrl = meta.thumbnailUrl;
        }
      } catch {
        // Metadata lookup is best-effort — fall back to the placeholder title.
      }
      const saved = await videoService.createVideo({
        courseId: selectedCourseId,
        videoId,
        videoUrl: trimmed,
        sourceType: source,
        title,
        thumbnailUrl,
        summary: null,
      });
      router.push(`/(tabs)/library/video/${saved.id}`);
      // Clear the form so returning to the summarizer starts fresh.
      setUrl('');
      setFile(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to add video. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const pickFile = async () => {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'video/mp4', size: asset.size });
  };

  const submitUpload = async () => {
    if (!file) return;
    // Already uploaded — the duplicate banner offers the way to it instead.
    if (duplicateUpload) return;
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setError('');
    setLoading(true);
    try {
      const saved = await videoService.uploadVideo(selectedCourseId, file);
      router.push(`/(tabs)/library/video/${saved.id}`);
      // Clear the form so returning to the summarizer starts fresh.
      setFile(null);
      setUrl('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Upload failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <SubTabChipRow options={SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'link' ? (
        <IntroCard
          icon={Video}
          iconColor={Colors.red}
          title="Paste a video link"
          subtitle="YouTube, Bilibili, Vimeo, TED, Dailymotion, TikTok, and more."
        >
          <TextField
            value={url}
            onChangeText={(v) => { setUrl(v); setError(''); }}
            placeholder="https://www.youtube.com/watch?v=…"
            keyboardType="url"
            style={styles.input}
          />
        </IntroCard>
      ) : (
        <Dropzone
          icon={FileVideo}
          title={file ? file.name : 'Choose a video file'}
          subtitle="MP4, MOV, and most common video formats"
          onPress={pickFile}
        />
      )}

      {subTab === 'link' && duplicate?.kind === 'video' && (
        <DuplicateAlert
          label="video"
          courseName={duplicate.data.courseName}
          onView={() => router.push(`/(tabs)/library/video/${duplicate.data.id}`)}
        />
      )}

      {subTab === 'upload' && duplicateUpload?.kind === 'video' && (
        <DuplicateAlert
          label="video file"
          courseName={duplicateUpload.data.courseName}
          onView={() => router.push(`/(tabs)/library/video/${duplicateUpload.data.id}`)}
        />
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button
        title={(subTab === 'link' ? duplicate : duplicateUpload) ? 'Already in Library' : 'Analyze Video'}
        onPress={() => runExclusive(subTab === 'link' ? submitLink : submitUpload)}
        loading={loading}
        disabled={subTab === 'link' ? !url.trim() || !!duplicate : !file || !!duplicateUpload}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  input: { width: '100%', height: 44, backgroundColor: Colors.bgApp },
  error: { fontSize: 13, color: Colors.red },
});
