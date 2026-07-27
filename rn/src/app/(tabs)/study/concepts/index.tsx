import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ConceptsTab } from '@/components/concepts/ConceptsTab';
import { GapsTab } from '@/components/concepts/GapsTab';
import { LearningPathTab } from '@/components/concepts/LearningPathTab';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { Colors, Spacing } from '@/constants/theme';
import { conceptLinksService, type KnowledgeGaps, type KnowledgeGraph, type LearningPath } from '@/services/conceptLinksService';

type Tab = 'concepts' | 'gaps' | 'path';

export default function ConceptsScreen() {
  const [tab, setTab] = useState<Tab>('concepts');
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [gaps, setGaps] = useState<KnowledgeGaps | null>(null);
  const [path, setPath] = useState<LearningPath | null>(null);

  useEffect(() => {
    conceptLinksService.getKnowledgeGraph().then(setGraph);
    conceptLinksService.getKnowledgeGaps().then(setGaps);
    conceptLinksService.getLearningPath().then(setPath);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'concepts', label: 'Concepts' },
            { value: 'gaps', label: 'Gaps' },
            { value: 'path', label: 'Learning Path' },
          ]}
        />
      </View>

      {tab === 'concepts' && (graph ? <ConceptsTab graph={graph} /> : <ActivityIndicator style={styles.loading} color={Colors.primary} />)}
      {tab === 'gaps' && (gaps ? <GapsTab gaps={gaps} /> : <ActivityIndicator style={styles.loading} color={Colors.primary} />)}
      {tab === 'path' && (path ? <LearningPathTab path={path} /> : <ActivityIndicator style={styles.loading} color={Colors.primary} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  tabs: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  loading: { marginTop: Spacing.five },
});
