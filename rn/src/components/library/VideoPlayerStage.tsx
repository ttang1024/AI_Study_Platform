import React, { useMemo, type RefObject } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors, Spacing } from '@/constants/theme';
import { buildEmbedSource, buildEmbedUrl } from '@/services/videoEmbed';
import type { VideoDetail } from '@/services/videoService';
import { UploadedVideoPlayer, YoutubeEmbeddedPlayer } from '@/components/library/videoPlayers';
import type { SeekHandle } from '@/components/library/videoDetailMeta';

interface Props {
  video: VideoDetail;
  uploadedRef: RefObject<SeekHandle | null>;
  youtubeRef: RefObject<SeekHandle | null>;
  embedStartSeconds: number;
  embedSeekNonce: number;
}

export function VideoPlayerStage({ video, uploadedRef, youtubeRef, embedStartSeconds, embedSeekNonce }: Props) {
  const { width } = useWindowDimensions();
  const videoHeight = useMemo(() => (width * 9) / 16, [width]);

  const embedUrl = video.sourceType && video.sourceType !== 'upload' && video.sourceType !== 'youtube'
    ? buildEmbedUrl(video.sourceType, video.videoId, video.videoUrl, embedStartSeconds)
    : null;

  return (
    <View style={[styles.player, { width, height: videoHeight }]}>
      {video.sourceType === 'upload' ? (
        <UploadedVideoPlayer ref={uploadedRef} videoRecordId={video.id} width={width} height={videoHeight} />
      ) : video.sourceType === 'youtube' ? (
        <YoutubeEmbeddedPlayer ref={youtubeRef} videoId={video.videoId} width={width} height={videoHeight} />
      ) : embedUrl ? (
        <WebView
          key={embedSeekNonce}
          source={buildEmbedSource(embedUrl)}
          style={{ width, height: videoHeight }}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      ) : (
        <Text style={styles.unsupported}>This video source isn&apos;t supported yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  player: { backgroundColor: '#000' },
  unsupported: { flex: 1, textAlign: 'center', marginTop: Spacing.five, color: Colors.textSecondary },
});
