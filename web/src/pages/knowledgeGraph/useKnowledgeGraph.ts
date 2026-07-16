import { useEffect, useMemo, useState } from 'react';
import {
  knowledgeGraphService, KnowledgeGraph, KnowledgeGraphNode, ConceptGap, LearningPath,
} from '../../services/knowledgeGraphService';
import { useStudy } from '../../context/StudyContext';

/** Data loading, filtering and selection state behind KnowledgeGraphPage (everything except the D3 render). */
export function useKnowledgeGraph() {
  const { courses, courseMaterialCounts } = useStudy();
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KnowledgeGraphNode | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [conceptModalOpen, setConceptModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [gaps, setGaps] = useState<ConceptGap[]>([]);
  const [showGaps, setShowGaps] = useState(true);
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);

  const gapById = useMemo(() => new Map(gaps.map(g => [g.id, g])), [gaps]);

  useEffect(() => {
    if (selected?.type !== 'quiz') setQuizModalOpen(false);
    if (selected?.type !== 'concept') setConceptModalOpen(false);
    if (selected?.type !== 'note') setNoteModalOpen(false);
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    knowledgeGraphService.getKnowledgeGraph()
      .then(data => {
        if (!cancelled) {
          setGraph(data);
          setSelected(data.nodes[0] ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load your knowledge graph.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    knowledgeGraphService.getKnowledgeGaps()
      .then(data => { if (!cancelled) setGaps(data.gaps); })
      .catch(() => { /* gaps are non-critical */ });
    knowledgeGraphService.getLearningPath()
      .then(data => { if (!cancelled) setLearningPath(data); })
      .catch(() => { /* learning path is non-critical */ });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!graph) return null;
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch = (node: KnowledgeGraphNode) =>
      !normalizedSearch
      || node.title.toLowerCase().includes(normalizedSearch)
      || node.subtitle?.toLowerCase().includes(normalizedSearch);

    let nodes: KnowledgeGraphNode[];
    if (selectedCourseId === null) {
      nodes = graph.nodes.filter(matchesSearch);
    } else {
      const courseNodeIds = new Set(
        graph.nodes.filter(n => n.courseId === selectedCourseId).map(n => n.id),
      );
      const includedIds = new Set(courseNodeIds);
      graph.edges.forEach(e => {
        if (courseNodeIds.has(e.source)) includedIds.add(e.target);
        if (courseNodeIds.has(e.target)) includedIds.add(e.source);
      });
      nodes = graph.nodes.filter(n => includedIds.has(n.id) && matchesSearch(n));
    }

    const ids = new Set(nodes.map(n => n.id));
    const edges = graph.edges.filter(e => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [graph, search, selectedCourseId]);

  const selectGap = (gap: ConceptGap) => {
    setSearch('');
    const node = graph?.nodes.find(n => n.id === gap.id);
    if (node) setSelected(node);
  };

  const coursesWithMaterials = useMemo(() =>
    courses.filter(c => {
      const counts = courseMaterialCounts.find(m => m.courseId === c.id);
      return counts && (counts.documents + counts.articles + counts.audio + counts.videos) > 0;
    }),
    [courses, courseMaterialCounts]);

  // Default to the first course that has content (the "All Courses" tab is hidden here).
  useEffect(() => {
    if (selectedCourseId === null && coursesWithMaterials.length > 0) {
      setSelectedCourseId(coursesWithMaterials[0].id);
    }
  }, [coursesWithMaterials, selectedCourseId]);

  return {
    graph, loading, error,
    selected, setSelected,
    search, setSearch,
    selectedCourseId, setSelectedCourseId,
    quizModalOpen, setQuizModalOpen,
    conceptModalOpen, setConceptModalOpen,
    noteModalOpen, setNoteModalOpen,
    gaps, showGaps, setShowGaps,
    learningPath,
    gapById, filtered, selectGap, coursesWithMaterials,
    activeNodes: filtered?.nodes ?? [],
    activeEdges: filtered?.edges ?? [],
  };
}
