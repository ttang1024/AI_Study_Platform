import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as d3 from 'd3';
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Loader2,
  Network,
  PlayCircle,
  Search,
} from 'lucide-react';
import { CONTENT_TYPE_ICONS, STUDY_TYPE_ICONS } from '../constants/contentTypeIcons';
import { knowledgeGraphService, KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode } from '../services/knowledgeGraphService';
import { QuizPreviewModal } from '../components/quiz/QuizPreviewModal';
import { ConceptPreviewModal } from '../components/knowledge-graph/ConceptPreviewModal';
import { NotePreviewModal } from '../components/knowledge-graph/NotePreviewModal';
import { SourceFilterBar, SourceType } from '../components/common/SourceFilterBar';
import { useStudy } from '../context/StudyContext';

type GraphNode = KnowledgeGraphNode & d3.SimulationNodeDatum;
type GraphLink = Omit<KnowledgeGraphEdge, 'source' | 'target'> & d3.SimulationLinkDatum<GraphNode>;

const nodeStyles: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  concept:  { color: '#0d9488', bg: '#ccfbf1', icon: BrainCircuit,                                                            label: 'Concept'   }, // teal    ~160°
  document: { color: '#2563eb', bg: '#dbeafe', icon: CONTENT_TYPE_ICONS.document.icon,                                        label: 'Document'  }, // blue    ~240°
  article:  { color: '#65a30d', bg: '#ecfccb', icon: CONTENT_TYPE_ICONS.article.icon,                                         label: 'Article'   }, // lime    ~80°
  audio:    { color: '#0284c7', bg: '#e0f2fe', icon: CONTENT_TYPE_ICONS.audio.icon,                                           label: 'Audio'     }, // sky     ~200°
  podcast:  { color: '#c026d3', bg: '#fae8ff', icon: CONTENT_TYPE_ICONS.podcast.icon,                                         label: 'Podcast'   }, // fuchsia ~300°
  video:    { color: '#dc2626', bg: '#fee2e2', icon: CONTENT_TYPE_ICONS.video.icon,                                           label: 'Video'     }, // red     ~0°
  note:     { color: STUDY_TYPE_ICONS.notes.color,     bg: STUDY_TYPE_ICONS.notes.bg,     icon: STUDY_TYPE_ICONS.notes.icon,     label: 'Note'      }, // violet  ~280°
  quiz:     { color: STUDY_TYPE_ICONS.quiz.color,      bg: STUDY_TYPE_ICONS.quiz.bg,      icon: STUDY_TYPE_ICONS.quiz.icon,      label: 'Quiz'      }, // green   ~140°
  flashcard:{ color: STUDY_TYPE_ICONS.flashcard.color, bg: STUDY_TYPE_ICONS.flashcard.bg, icon: STUDY_TYPE_ICONS.flashcard.icon, label: 'Flashcard' }, // amber   ~40°
};

const getNodeStyle = (type: string) => nodeStyles[type] ?? nodeStyles.concept;

const getNodeRadius = (node: KnowledgeGraphNode) => {
  if (node.type === 'concept') return Math.min(22, 9 + node.weight * 1.4);
  if (['document', 'video', 'article', 'audio', 'podcast'].includes(node.type)) return Math.min(28, 13 + node.weight * 1.6);
  return Math.min(20, 10 + node.weight);
};

const getNodeTarget = (node: KnowledgeGraphNode) => node.url || undefined;

export const KnowledgeGraphPage: React.FC = () => {
  const { courses, courseMaterialCounts } = useStudy();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KnowledgeGraphNode | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [conceptModalOpen, setConceptModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);

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

  useEffect(() => {
    if (!filtered || !svgRef.current || !wrapperRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = wrapperRef.current.clientWidth || 960;
    const height = wrapperRef.current.clientHeight || 620;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: GraphNode[] = filtered.nodes.map(node => ({ ...node }));
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const links: GraphLink[] = filtered.edges
      .filter(edge => nodeById.has(edge.source) && nodeById.has(edge.target))
      .map(edge => ({ ...edge, source: edge.source, target: edge.target }));

    const viewport = svg.append('g');
    const linkLayer = viewport.append('g').attr('stroke', '#94a3b8').attr('stroke-opacity', 0.34);
    const nodeLayer = viewport.append('g');
    const labelLayer = viewport.append('g');

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.35, 2.5])
        .on('zoom', event => viewport.attr('transform', event.transform)),
    );

    const link = linkLayer
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', edge => Math.min(5, 1 + (edge.weight ?? 1) * 0.45));

    const node = nodeLayer
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', getNodeRadius)
      .attr('fill', d => getNodeStyle(d.type).color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2.5)
      .attr('class', 'cursor-pointer')
      .on('click', (_, d) => setSelected(d))
      .call(
        d3.drag<SVGCircleElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    const label = labelLayer
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => d.title.length > 28 ? `${d.title.slice(0, 27)}...` : d.title)
      .attr('font-size', d => d.type === 'concept' ? 10 : 11)
      .attr('font-weight', d => ['document', 'video', 'article', 'audio', 'podcast'].includes(d.type) ? 700 : 600)
      .attr('fill', '#334155')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3)
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none');

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(edge => edge.label === 'defines' ? 82 : 118).strength(0.58))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => getNodeRadius(d) + 24));

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0);

      node
        .attr('cx', d => d.x ?? 0)
        .attr('cy', d => d.y ?? 0);

      label
        .attr('x', d => d.x ?? 0)
        .attr('y', d => ((d.y ?? 0) + getNodeRadius(d) + 14));
    });

    return () => {
      simulation.stop();
    };
  }, [filtered]);

  const coursesWithMaterials = useMemo(() =>
    courses.filter(c => {
      const counts = courseMaterialCounts.find(m => m.courseId === c.id);
      return counts && (counts.documents + counts.articles + counts.audio + counts.videos) > 0;
    }),
    [courses, courseMaterialCounts]);

  const activeNodes = filtered?.nodes ?? [];
  const activeEdges = filtered?.edges ?? [];
  const selectedStyle = selected ? getNodeStyle(selected.type) : null;
  const SelectedIcon = selectedStyle?.icon ?? Network;
  const graphSourceType: SourceType = 'all';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mt-2 text-4xl font-black text-text-main">
            Cross-material <span className="text-emerald-600">Concept Map</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Connect concepts, notes, quizzes, flashcards, and materials across courses.
          </p>
        </div>
        {graph && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Materials', graph.stats.materials],
              ['Concepts', graph.stats.concepts],
              ['Notes', graph.stats.notes],
              ['Quizzes', graph.stats.quizzes],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-right shadow-sm">
                <p className="text-lg font-bold tabular-nums text-text-main">{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-h-[640px] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-black/[0.06] p-4">
            <SourceFilterBar
              courses={coursesWithMaterials}
              selectedCourseId={selectedCourseId}
              onSelectCourse={setSelectedCourseId}
              sourceType={graphSourceType}
              onSelectType={() => undefined}
              hideTypeTabs
            />
            <div className="relative w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search concepts or materials"
                className="h-10 w-full rounded-xl border border-black/[0.08] bg-[var(--bg-app)] pl-9 pr-3 text-sm text-text-main outline-none transition focus:border-[var(--primary)]"
              />
            </div>
          </div>
          <div ref={wrapperRef} className="relative h-[620px] bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.09)_1px,transparent_0)] [background-size:22px_22px]">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-text-muted">
                <Loader2 size={18} className="animate-spin" />
                Loading graph
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-red-600">
                <AlertCircle size={18} />
                {error}
              </div>
            ) : activeNodes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <Network size={34} className="text-text-muted" />
                <p className="mt-3 text-sm font-semibold text-text-main">No graph nodes match this view</p>
                <p className="mt-1 max-w-md text-sm text-text-muted">Generate glossary terms or mind maps from your materials to add concept relationships.</p>
                <Link to="/summarizer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">
                  Add material
                  <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <>
                <svg ref={svgRef} className="h-full w-full" role="img" aria-label="Knowledge graph" />
                <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-black/[0.06] bg-white/90 px-3 py-2 text-xs text-text-muted shadow-sm backdrop-blur">
                  Drag nodes. Scroll to zoom. Click a node for details.
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-text-main">Selected node</p>
            {selected ? (
              <div className="mt-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: selectedStyle?.bg, color: selectedStyle?.color }}
                  >
                    <SelectedIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-text-main">{selected.title}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{selectedStyle?.label ?? selected.type}</p>
                    {selected.subtitle && <p className="mt-2 text-sm text-text-muted">{selected.subtitle}</p>}
                  </div>
                </div>
                {selected.type === 'quiz' ? (
                  <button
                    onClick={() => setQuizModalOpen(true)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    View Questions
                    <STUDY_TYPE_ICONS.quiz.icon size={16} />
                  </button>
                ) : selected.type === 'concept' ? (
                  <button
                    onClick={() => setConceptModalOpen(true)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    View Definition
                    <BrainCircuit size={16} />
                  </button>
                ) : selected.type === 'note' ? (
                  <button
                    onClick={() => setNoteModalOpen(true)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    View Note
                    <STUDY_TYPE_ICONS.notes.icon size={16} />
                  </button>
                ) : getNodeTarget(selected) ? (
                  <Link
                    to={getNodeTarget(selected)!}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Open
                    <PlayCircle size={16} />
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-text-muted">Select a node to inspect it.</p>
            )}
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-text-main">Visible graph</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[var(--bg-app)] p-3">
                <p className="text-xl font-bold tabular-nums text-text-main">{activeNodes.length}</p>
                <p className="text-xs text-text-muted">Nodes</p>
              </div>
              <div className="rounded-xl bg-[var(--bg-app)] p-3">
                <p className="text-xl font-bold tabular-nums text-text-main">{activeEdges.length}</p>
                <p className="text-xs text-text-muted">Links</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-text-main">Legend</p>
            <div className="mt-3 space-y-2">
              {Object.entries(nodeStyles).map(([type, style]) => {
                const Icon = style.icon;
                return (
                  <div key={type} className="flex items-center gap-2 text-sm text-text-muted">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: style.bg, color: style.color }}>
                      <Icon size={14} />
                    </span>
                    {style.label}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {quizModalOpen && selected?.type === 'quiz' && (
        <QuizPreviewModal node={selected} onClose={() => setQuizModalOpen(false)} />
      )}
      {conceptModalOpen && selected?.type === 'concept' && (
        <ConceptPreviewModal node={selected} onClose={() => setConceptModalOpen(false)} />
      )}
      {noteModalOpen && selected?.type === 'note' && (
        <NotePreviewModal node={selected} onClose={() => setNoteModalOpen(false)} />
      )}
    </div>
  );
};
