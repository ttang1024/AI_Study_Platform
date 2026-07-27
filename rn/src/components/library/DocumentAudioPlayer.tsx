import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';

export function DocumentAudioPlayer({ url }: { url: string }) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);

  return (
    <View style={styles.audioBar}>
      <Pressable
        style={styles.audioButton}
        onPress={() => (status.playing ? player.pause() : player.play())}
      >
        {status.playing ? <Pause size={20} color={Colors.primaryForeground} /> : <Play size={20} color={Colors.primaryForeground} />}
      </Pressable>
      <Text style={styles.audioLabel}>{status.playing ? 'Playing…' : 'Tap to play'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  audioBar: {
    ...Layout.row, gap: Spacing.two,
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three,
  },
  audioButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, ...Layout.center },
  audioLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
});
