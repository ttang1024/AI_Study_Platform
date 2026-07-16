import { useEffect, useState, RefObject } from 'react';
import * as d3 from 'd3';
import { ConceptGap, KnowledgeGraphEdge, KnowledgeGraphNode } from '../../services/knowledgeGraphService';
import { GraphNode, GraphLink, getNodeRadius, getNodeStyle, SEVERITY_COLORS } from './graphStyles';

interface FilteredGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

/**
 * Owns the force-directed D3 render: tracks the wrapper's size via ResizeObserver
 * and re-lays-out the SVG whenever the filtered graph, gap overlay or size changes.
 */
export function useGraphSimulation(
  svgRef: RefObject<SVGSVGElement | null>,
  wrapperRef: RefObject<HTMLDivElement | null>,
  filtered: FilteredGraph | null,
  gapById: Map<string, ConceptGap>,
  showGaps: boolean,
  onSelectNode: (node: KnowledgeGraphNode) => void,
) {
  const [dims, setDims] = useState({ width: 0, height: 0 });

  // Track the graph wrapper's real size. It now fills the section (which stretches to
  // match the taller sidebar on large screens), so the size is layout-driven rather
  // than fixed — re-layout whenever it changes so the SVG fills the area without
  // leaving dead space or scaling/letterboxing.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims(prev =>
        Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width: Math.round(width), height: Math.round(height) },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [wrapperRef]);

  useEffect(() => {
    if (!filtered || !svgRef.current || !wrapperRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = dims.width || wrapperRef.current.clientWidth || 960;
    const height = dims.height || wrapperRef.current.clientHeight || 620;
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
      .attr('stroke', d => (showGaps && gapById.has(d.id)) ? SEVERITY_COLORS[gapById.get(d.id)!.severity] : '#ffffff')
      .attr('stroke-width', d => (showGaps && gapById.has(d.id)) ? 4 : 2.5)
      .attr('class', 'cursor-pointer')
      .on('click', (_, d) => onSelectNode(d))
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
  }, [filtered, gapById, showGaps, dims, svgRef, wrapperRef, onSelectNode]);
}
