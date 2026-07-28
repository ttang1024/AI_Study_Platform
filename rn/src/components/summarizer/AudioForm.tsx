import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Headphones from 'lucide-react-native/icons/headphones';
import Mic from 'lucide-react-native/icons/mic';
import Rss from 'lucide-react-native/icons/rss';

import { Button } from '@/components/Button';
import { DuplicateAlert } from '@/components/summarizer/DuplicateAlert';
import { findDuplicateDocument } from '@/components/summarizer/duplicateFile';
import { Dropzone } from '@/components/summarizer/Dropzone';
import { IntroCard } from '@/components/summarizer/IntroCard';
import { SubTabChipRow } from '@/components/summarizer/SubTabChipRow';
import { TextField } from '@/components/TextField';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { documentService } from '@/services/documentService';
import { podcastService, PodcastFeed, PodcastFeedEpisode } from '@/services/podcastService';
import { looksLikeRssFeedUrl, validatePodcastUrl } from '@/constants/podcastSources';
import { useLibraryEntries } from '@/hooks/useLibraryEntries';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { getApiErrorCode, getApiErrorMessage } from '@/utils/apiError';
import type { PickedFile } from '@/types';

interface AudioFormProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

type SubTab = 'podcast' | 'lecture';

const SUB_TABS: { id: SubTab; label: string; icon: typeof Rss }[] = [
  { id: 'podcast', label: 'Podcast', icon: Rss },
  { id: 'lecture', label: 'Audio Lecture', icon: Mic },
];

export function AudioForm({ selectedCourseId, onCourseError }: AudioFormProps) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>('podcast');

  const [podcastUrl, setPodcastUrl] = useState('');
  const [podcastError, setPodcastError] = useState('');
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [feed, setFeed] = useState<PodcastFeed | null>(null);
  const [feedUrl, setFeedUrl] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);

  const [file, setFile] = useState<PickedFile | null>(null);
  const [lectureError, setLectureError] = useState('');
  const [lectureUploading, setLectureUploading] = useState(false);

  const audioEntries = useLibraryEntries('audio');
  const runExclusive = useSubmitLock();
  const trimmedPodcastUrl = podcastUrl.trim();
  const duplicate = trimmedPodcastUrl
    ? audioEntries.find((e) => e.kind === 'document' && e.data.originalUrl === trimmedPodcastUrl)
    : undefined;
  // An uploaded lecture lands in the same audio list, so the picked file is checked against it too.
  const duplicateLecture = findDuplicateDocument(audioEntries, file);

  const loadFeed = async (url: string) => {
    setPodcastError('');
    setPodcastLoading(true);
    try {
      const result = await podcastService.getFeed(url);
      setFeed(result);
      setFeedUrl(url);
    } catch (err) {
      setPodcastError(getApiErrorMessage(err, 'Could not read a podcast feed at that link.'));
    } finally {
      setPodcastLoading(false);
    }
  };

  const submitPodcast = async () => {
    const trimmed = podcastUrl.trim();
    if (!trimmed) return;
    // Don't import an episode that's already in the library — the duplicate banner is shown instead.
    if (duplicate) return;
    const validationError = validatePodcastUrl(trimmed);
    if (validationError) {
      setPodcastError(validationError);
      return;
    }
    if (looksLikeRssFeedUrl(trimmed)) {
      await loadFeed(trimmed);
      return;
    }
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setPodcastError('');
    setPodcastLoading(true);
    try {
      const episode = await podcastService.create(trimmed, selectedCourseId);
      router.push(`/(tabs)/library/document/${episode.documentId}?courseId=${episode.courseId}`);
      // Clear the form so returning to the summarizer starts fresh.
      setPodcastUrl('');
      setFeed(null);
      setFeedUrl('');
    } catch (err) {
      if (getApiErrorCode(err) === 'RSS_FEED_URL') {
        await loadFeed(trimmed);
        return;
      }
      setPodcastError(getApiErrorMessage(err, 'Failed to fetch podcast episode. Please check the URL and try again.'));
    } finally {
      setPodcastLoading(false);
    }
  };

  const importEpisode = async (ep: PodcastFeedEpisode) => {
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setPodcastError('');
    setImportingId(ep.id);
    try {
      const episode = await podcastService.createFromFeed(feedUrl, ep.id, selectedCourseId);
      router.push(`/(tabs)/library/document/${episode.documentId}?courseId=${episode.courseId}`);
      // Clear the form so returning to the summarizer starts fresh.
      setImportingId(null);
      setPodcastUrl('');
      setFeed(null);
      setFeedUrl('');
    } catch (err) {
      setPodcastError(getApiErrorMessage(err, 'Failed to import this episode. Please try again.'));
      setImportingId(null);
    }
  };

  const pickLectureFile = async () => {
    setLectureError('');
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'audio/mpeg', size: asset.size });
  };

  const submitLecture = async () => {
    if (!file) return;
    // Already uploaded — the duplicate banner offers the way to it instead.
    if (duplicateLecture) return;
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setLectureError('');
    setLectureUploading(true);
    try {
      const result = await documentService.uploadAudio(selectedCourseId, file);
      router.push(`/(tabs)/library/document/${result.documentId}?courseId=${selectedCourseId}`);
      // Clear the form so returning to the summarizer starts fresh.
      setFile(null);
    } catch {
      setLectureError('Upload failed. Please try again.');
    } finally {
      setLectureUploading(false);
    }
  };

  return (
    <View style={styles.root}>
      <SubTabChipRow options={SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'podcast' ? (
        <>
          <IntroCard
            icon={Rss}
            iconColor={Colors.amber}
            title="Turn any podcast into study material"
            subtitle="Episode link, RSS feed, or direct MP3."
          >
            <TextField
              value={podcastUrl}
              onChangeText={(v) => { setPodcastUrl(v); setPodcastError(''); }}
              placeholder="https://podcasts.apple.com/…?i=…"
              keyboardType="url"
              style={styles.input}
            />
          </IntroCard>

          {duplicate?.kind === 'document' && (
            <DuplicateAlert
              label="podcast episode"
              courseName={duplicate.data.courseName ?? ''}
              onView={() => router.push(`/(tabs)/library/document/${duplicate.data.id}?courseId=${duplicate.data.courseId}`)}
            />
          )}

          {!!podcastError && <Text style={styles.error}>{podcastError}</Text>}

          {feed && (
            <View style={styles.feedCard}>
              <View style={styles.feedHeader}>
                <Text style={styles.feedTitle} numberOfLines={1}>{feed.title || 'Podcast feed'}</Text>
                <Pressable onPress={() => { setFeed(null); setFeedUrl(''); }}>
                  <Text style={styles.feedClose}>Close</Text>
                </Pressable>
              </View>
              <FlatList
                data={feed.episodes}
                keyExtractor={(ep) => ep.id}
                style={styles.feedList}
                renderItem={({ item }) => (
                  <View style={styles.episodeRow}>
                    <Text style={styles.episodeTitle} numberOfLines={2}>{item.title}</Text>
                    <Pressable
                      style={styles.episodeButton}
                      onPress={() => runExclusive(() => importEpisode(item))}
                      disabled={importingId !== null}
                    >
                      {importingId === item.id ? (
                        <ActivityIndicator size="small" color={Colors.amber} />
                      ) : (
                        <Text style={styles.episodeButtonText}>Add</Text>
                      )}
                    </Pressable>
                  </View>
                )}
              />
            </View>
          )}

          <Button
            title={duplicate ? 'Already in Library' : looksLikeRssFeedUrl(podcastUrl) ? 'Browse Episodes' : 'Analyze Episode'}
            onPress={() => runExclusive(submitPodcast)}
            loading={podcastLoading}
            disabled={!podcastUrl.trim() || importingId !== null || !!duplicate}
          />
        </>
      ) : (
        <>
          <Dropzone
            icon={Headphones}
            title={file ? file.name : 'Choose an audio file'}
            subtitle="MP3, M4A, WAV, and other common audio formats"
            onPress={pickLectureFile}
          />

          {duplicateLecture && (
            <DuplicateAlert
              label="file"
              courseName={duplicateLecture.courseName ?? ''}
              onView={() => router.push(`/(tabs)/library/document/${duplicateLecture.id}?courseId=${duplicateLecture.courseId}`)}
            />
          )}

          {!!lectureError && <Text style={styles.error}>{lectureError}</Text>}

          <Button
            title={duplicateLecture ? 'Already in Library' : 'Upload & Analyze'}
            onPress={() => runExclusive(submitLecture)}
            loading={lectureUploading}
            disabled={!file || !!duplicateLecture}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  input: { width: '100%', height: 44, backgroundColor: Colors.bgApp },
  error: { fontSize: 13, color: Colors.red },
  feedCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, backgroundColor: Colors.bgSidebar, overflow: 'hidden' },
  feedHeader: {
    ...Layout.rowBetween, padding: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  feedTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  feedClose: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  feedList: { maxHeight: 280 },
  episodeRow: {
    ...Layout.row, gap: Spacing.two,
    padding: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.zinc200,
  },
  episodeTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  episodeButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.lg, backgroundColor: `${Colors.amber}22` },
  episodeButtonText: { fontSize: 12, fontWeight: '700', color: Colors.amber },
});
