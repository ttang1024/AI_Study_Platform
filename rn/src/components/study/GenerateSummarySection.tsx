import React, { useState } from 'react';
import { FileText } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';

interface GenerateSummarySectionProps {
  // Resolves to the final summary text — document generation resolves in one shot,
  // video generation streams chunks and accumulates them before resolving.
  onGenerate: () => Promise<string>;
  onGenerated: (summaryText: string) => void;
}

// Shared by document/[id].tsx and video/[id].tsx — was previously two byte-identical
// copies differing only in the async generation call each screen wired up.
export const GenerateSummarySection: React.FC<GenerateSummarySectionProps> = ({ onGenerate, onGenerated }) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);

  const run = async () => {
    setGenerating(true);
    setError(false);
    try {
      const text = await onGenerate();
      onGenerated(text);
    } catch {
      setError(true);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <EmptyState
      icon={FileText}
      title={error ? 'Couldn’t generate a summary' : 'No Summary Yet'}
      subtitle={error ? 'Something went wrong — try again.' : 'Get a concise AI-written overview of this material.'}
      action={{ label: generating ? 'Generating…' : 'Generate Summary', onPress: run, loading: generating }}
    />
  );
};
