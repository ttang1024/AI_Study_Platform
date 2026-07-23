import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Network from 'lucide-react-native/icons/network';

import { EmptyState } from '@/components/EmptyState';
import { SearchBar } from '@/components/SearchBar';
import { ConceptRow } from '@/components/concepts/ConceptRow';
import { Spacing } from '@/constants/theme';
import type { ConceptNode, KnowledgeGraph } from '@/services/conceptLinksService';

interface ConceptsTabProps {
  graph: KnowledgeGraph;
}

export const ConceptsTab: React.FC<ConceptsTabProps> = ({ graph }) => {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const nodesById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nodes = q ? graph.nodes.filter((n) => n.title.toLowerCase().includes(q)) : graph.nodes;
    return [...nodes].sort((a, b) => b.weight - a.weight);
  }, [graph.nodes, search]);

  const adjacencyFor = useCallback((node: ConceptNode) => {
    const groups = new Map<string, ConceptNode[]>();
    for (const edge of graph.edges) {
      const isSource = edge.source === node.id;
      const isTarget = edge.target === node.id;
      if (!isSource && !isTarget) continue;
      const otherId = isSource ? edge.target : edge.source;
      const other = nodesById.get(otherId);
      if (!other) continue;
      const label = edge.label ?? (isSource ? 'Related' : 'Referenced by');
      const list = groups.get(label) ?? [];
      list.push(other);
      groups.set(label, list);
    }
    return groups;
  }, [graph.edges, nodesById]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search concepts and materials…" />
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon={Network} title="Nothing here yet" subtitle="Concepts build up as you add documents, notes, quizzes, and glossary terms." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            return (
              <ConceptRow
                node={item}
                expanded={expanded}
                adjacency={expanded ? adjacencyFor(item) : EMPTY_ADJACENCY}
                onToggle={toggleExpand}
              />
            );
          }}
        />
      )}
    </View>
  );
};

const EMPTY_ADJACENCY = new Map<string, ConceptNode[]>();

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { padding: Spacing.three, paddingBottom: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
});
