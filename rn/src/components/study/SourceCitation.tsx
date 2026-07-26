import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Quote from 'lucide-react-native/icons/quote';

import { Colors, Spacing, Typography } from '@/constants/theme';
import type { SourceCitation as Citation } from '@/types';

interface Props {
  citation?: Citation;
  documentId?: string;
  videoId?: string;
}

const formatTimestamp = (seconds: number): string => {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/**
 * Attribution for an AI-generated artifact: the passage it came from, plus a way to open that spot
 * in the source.
 *
 * Renders nothing without a citation. Artifacts made before citations existed, and any whose
 * supporting quote could not be located in the source, simply have none — that absence is meaningful
 * and must not be papered over with a guessed position.
 */
export const SourceCitation: React.FC<Props> = ({ citation, documentId, videoId }) => {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  if (!citation) return null;

  // `!= null` throughout, never `!== undefined`: the API serializes an unresolved offset as an
  // explicit null, which passes an undefined check and yields a jump to position zero.
  const isLocated = citation.startOffset != null && citation.endOffset != null;
  const hasTimestamp = citation.startSeconds != null;

  const jump = () => {
    if (videoId && hasTimestamp) {
      router.push({
        pathname: '/(tabs)/library/video/[id]',
        params: { id: videoId, t: String(Math.floor(citation.startSeconds!)) },
      } as never);
      return;
    }

    if (documentId && isLocated) {
      router.push({
        pathname: '/(tabs)/library/document/source',
        params: {
          id: documentId,
          start: String(citation.startOffset),
          end: String(citation.endOffset),
        },
      } as never);
    }
  };

  const canJump = (videoId && hasTimestamp) || (documentId && isLocated);

  const label =
    hasTimestamp
      ? formatTimestamp(citation.startSeconds!)
      : citation.page != null
        ? `page ${citation.page}`
        : 'the source';

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.toggle} hitSlop={8}>
        <Quote size={12} color={Colors.textSecondary} />
        <Text style={styles.toggleText}>{expanded ? 'Hide source' : 'Show source'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <Text style={styles.quote}>“{citation.quote}”</Text>
          {canJump ? (
            <Pressable onPress={jump} style={styles.jump} hitSlop={8}>
              <Text style={styles.jumpText}>Jump to {label}</Text>
              <ExternalLink size={12} color={Colors.primary} />
            </Pressable>
          ) : (
            <Text style={styles.unlocated}>
              Quoted from the source; the exact position could not be resolved.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    paddingLeft: Spacing.two,
    paddingVertical: 4,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { ...Typography.caption, color: Colors.textSecondary },
  body: { gap: 6, marginTop: 6 },
  quote: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 19 },
  jump: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jumpText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  unlocated: { ...Typography.caption, color: Colors.textSecondary },
});

export default SourceCitation;
