import React, { useState } from 'react';
import { Sparkles } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';

interface GenerateGlossarySectionProps {
  onGenerate: () => Promise<unknown[]>;
}

// Shared by document/[id].tsx and video/[id].tsx — was previously two byte-identical copies.
export const GenerateGlossarySection: React.FC<GenerateGlossarySectionProps> = ({ onGenerate }) => {
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const run = async () => {
    setGenerating(true);
    try {
      const terms = await onGenerate();
      setCount(terms.length);
    } finally {
      setGenerating(false);
    }
  };

  if (count !== null) {
    return (
      <EmptyState
        icon={Sparkles}
        title={`Generated ${count} term${count === 1 ? '' : 's'}`}
        subtitle="Find them in your Glossary under Study."
        bordered
      />
    );
  }

  return (
    <EmptyState
      icon={Sparkles}
      title="No Glossary Yet"
      subtitle="Pull out key terms and definitions from this material."
      action={{ label: generating ? 'Generating…' : 'Generate Glossary', onPress: run, loading: generating }}
      bordered
    />
  );
};
