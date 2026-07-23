import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';

import { Colors, Layout, Radius } from '@/constants/theme';
import type { TtsState } from '@/hooks/useTts';

interface TtsPlayButtonProps {
  playerState: TtsState;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
}

// Shared by notes.tsx and glossary.tsx, whose "play all" header button was
// byte-identical apart from the label ternary.
export const TtsPlayButton: React.FC<TtsPlayButtonProps> = ({ playerState, onPlay, onPause, onResume }) => (
  <Pressable
    style={styles.button}
    onPress={() => (playerState === 'playing' ? onPause() : playerState === 'paused' ? onResume() : onPlay())}
  >
    {playerState === 'playing' ? (
      <Pause size={13} color={Colors.primaryForeground} />
    ) : (
      <Play size={13} color={Colors.primaryForeground} />
    )}
    <Text style={styles.text}>
      {playerState === 'idle' ? 'Play' : playerState === 'loading' ? 'Loading…' : playerState === 'playing' ? 'Pause' : 'Resume'}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    ...Layout.row, gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  text: { fontSize: 12, fontWeight: '700', color: Colors.primaryForeground },
});
