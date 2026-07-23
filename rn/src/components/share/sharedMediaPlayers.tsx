import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';

import { Colors, Layout, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

export function SharedAudioPlayer({ url }: { url: string }) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  return (
    <View style={styles.audioBar}>
      <Pressable style={styles.audioButton} onPress={() => (status.playing ? player.pause() : player.play())}>
        {status.playing ? <Pause size={20} color={Colors.primaryForeground} /> : <Play size={20} color={Colors.primaryForeground} />}
      </Pressable>
      <Text style={styles.audioLabel}>{status.playing ? 'Playing…' : 'Tap to play'}</Text>
    </View>
  );
}

export function SharedUploadedVideo({ url, width }: { url: string; width: number }) {
  const player = useVideoPlayer({ uri: url }, (p) => { p.loop = false; });
  return <VideoView style={{ width, height: (width * 9) / 16 }} player={player} nativeControls />;
}

const styles = StyleSheet.create({
  audioBar: {
    ...Layout.row, gap: Spacing.two,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three, ...Shadows.card,
  },
  audioButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, ...Layout.center },
  audioLabel: { ...Typography.bodyBold, color: Colors.textPrimary },
});
