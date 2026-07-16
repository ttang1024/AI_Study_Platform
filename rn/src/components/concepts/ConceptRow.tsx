import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import type { ConceptNode } from '@/services/conceptLinksService';
import { routeForNode } from '@/utils/conceptRoutes';

interface ConceptRowProps {
  node: ConceptNode;
  expanded: boolean;
  adjacency: Map<string, ConceptNode[]>;
  onToggle: (id: string) => void;
}

// Memoized so expanding one concept doesn't re-render every other row (and
// doesn't recompute every other row's adjacency groups).
export const ConceptRow: React.FC<ConceptRowProps> = React.memo(function ConceptRow({ node, expanded, adjacency, onToggle }) {
  const router = useRouter();

  return (
    <Card style={styles.card}>
      <Pressable style={styles.row} onPress={() => onToggle(node.id)}>
        <View style={styles.body}>
          <Text style={styles.typeBadge}>{node.type}</Text>
          <Text style={styles.title} numberOfLines={expanded ? undefined : 1}>{node.title}</Text>
        </View>
        {expanded ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          {!!node.description && <Text style={styles.description}>{node.description}</Text>}
          {Array.from(adjacency.entries()).map(([label, related]) => (
            <View key={label} style={styles.adjacencyGroup}>
              <Text style={styles.adjacencyLabel}>{label}</Text>
              {related.map((n) => (
                <Pressable key={n.id} onPress={() => routeForNode(n, router)}>
                  <Text style={styles.adjacencyItem}>{n.title}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          <Pressable onPress={() => routeForNode(node, router)}>
            <Text style={styles.openText}>Open</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { ...Layout.row, gap: Spacing.two },
  body: { flex: 1, gap: 2 },
  typeBadge: { ...Typography.captionBold, color: Colors.primary, textTransform: 'uppercase' },
  title: { ...Typography.bodyBold, color: Colors.textPrimary },
  detail: { gap: Spacing.two },
  description: { ...Typography.caption, color: Colors.textSecondary },
  adjacencyGroup: { gap: 2 },
  adjacencyLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
  adjacencyItem: { ...Typography.body, color: Colors.primary, paddingVertical: 2 },
  openText: { ...Typography.captionBold, color: Colors.primary, alignSelf: 'flex-start', marginTop: 4 },
});
