import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FileText } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { Radius, Spacing } from '@/constants/theme';
import { getApiErrorCode } from '@/utils/apiError';

interface GenerateSummarySectionProps {
  // Resolves to the final summary text — document generation resolves in one shot,
  // video generation streams chunks and accumulates them before resolving.
  onGenerate: () => Promise<string>;
  onGenerated: (summaryText: string) => void;
}

// Maps the error codes the backend returns from the summary endpoints to a
// message that tells the user what actually went wrong (and whether retrying
// will help). NO_TRANSCRIPT is terminal — the video has no captions to summarize.
function friendlyError(code: string): string {
  switch (code) {
    case 'NO_TRANSCRIPT':
      return 'No subtitles are available for this video, so a summary can’t be generated.';
    case 'MISSING_VIDEO_URL':
    case 'INVALID_VIDEO_URL':
      return 'This video’s source couldn’t be read.';
    default:
      return 'Something went wrong — try again.';
  }
}

// Relative line widths (%) that read as a couple of prose paragraphs while the
// summary is generating — the last line of each block is short like a paragraph end.
const SKELETON_LINES = ['92%', '98%', '85%', '60%', '95%', '90%', '70%'] as const;

// Shared by document/[id].tsx and video/[id].tsx — was previously two byte-identical
// copies differing only in the async generation call each screen wired up.
export const GenerateSummarySection: React.FC<GenerateSummarySectionProps> = ({ onGenerate, onGenerated }) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setGenerating(true);
    setError(null);
    try {
      const text = await onGenerate();
      onGenerated(text);
    } catch (err) {
      setError(friendlyError(getApiErrorCode(err)));
    } finally {
      setGenerating(false);
    }
  };

  // While generating, swap the CTA for a shimmering skeleton of the summary text
  // so the wait reads as "content on the way" rather than a stalled button.
  if (generating) {
    return (
      <View style={styles.skeleton} accessibilityLabel="Generating summary">
        <Skeleton width={90} height={12} radius={Radius.sm} />
        <View style={styles.lines}>
          {SKELETON_LINES.map((width, i) => (
            <Skeleton key={i} width={width} height={12} radius={Radius.sm} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <EmptyState
      icon={FileText}
      title={error ? 'Couldn’t generate a summary' : 'No Summary Yet'}
      subtitle={error ?? 'Get a concise AI-written overview of this material.'}
      action={{ label: 'Generate Summary', onPress: run }}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: { gap: Spacing.three, paddingVertical: Spacing.two },
  lines: { gap: Spacing.two },
});
