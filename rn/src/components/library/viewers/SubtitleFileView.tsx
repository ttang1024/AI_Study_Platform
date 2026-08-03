import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { parseCues } from '@core/viewers/subtitleCues';

interface Props {
  text: string;
  fileName: string;
}

/** Captions as a timestamped transcript. */
export function SubtitleFileView({ text, fileName }: Props) {
  const cues = useMemo(() => parseCues(text, fileName), [text, fileName]);

  if (cues.length === 0) return <Text style={styles.raw} selectable>{text}</Text>;

  return (
    <View style={styles.list}>
      <Text style={styles.meta}>
        {cues.length} {cues.length === 1 ? 'cue' : 'cues'}
      </Text>
      {cues.map((cue, index) => (
        <View key={index} style={styles.cue}>
          {!!cue.start && <Text style={styles.time} selectable={false}>{cue.start}</Text>}
          <Text style={styles.cueText} selectable>{cue.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.one },
  meta: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.one },
  cue: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  time: {
    width: 52, paddingTop: 2, fontSize: 11, color: Colors.textSecondary,
    fontVariant: ['tabular-nums'], textAlign: 'right',
  },
  cueText: { flex: 1, fontSize: 14, lineHeight: 21, color: Colors.textPrimary },
  raw: { fontSize: 13, lineHeight: 20, color: Colors.textPrimary },
});
