import React from 'react';
import { xmindMarkToMarkdown } from '../../pages/sharedContent/MarkmapView';

/**
 * A self-contained branching mind-map rendered as *pure* SVG (`<text>` + `<path>`).
 *
 * The interactive app uses markmap, but markmap draws node labels inside
 * `<foreignObject>` (HTML), which html-to-image / canvas rasterizers cannot
 * capture — producing a blank image in the shareable picture. Plain SVG text and
 * paths rasterize reliably, so this is used wherever the mind map must end up in a
 * raster image (the share card).
 */

interface MMNode {
  title: string;
  children: MMNode[];
  // layout fields
  x: number;
  y: number;
  w: number;
  depth: number;
  color: string;
}

const PAD_X = 8;
const PAD_Y = 5;
const ROW_H = 30;
const COL_GAP = 56;
const MARGIN = 16;
const MAX_LABEL = 40;

// Match the interactive markmap tab: d3 schemeCategory10, assigned per node in
// pre-order (the order markmap's scaleOrdinal first encounters each node path).
const PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

// Larger near the root, like markmap's heading-level sizing.
const fontForDepth = (d: number) => (d <= 0 ? 21 : d === 1 ? 16 : 14);
const lineForDepth = (d: number) => (d <= 0 ? 3 : d === 1 ? 2.2 : 1.6);
const nodeH = (n: MMNode) => fontForDepth(n.depth) + PAD_Y * 2;

const isWide = (ch: string) => /[　-鿿＀-￯㐀-䶿]/.test(ch);
function textWidth(s: string, fs: number): number {
  let w = 0;
  for (const ch of s) w += isWide(ch) ? fs : fs * 0.58;
  return w;
}

function clamp(title: string): string {
  return title.length > MAX_LABEL ? title.slice(0, MAX_LABEL - 1) + '…' : title;
}

/** Parse normalized markmap markdown (`# root`, 2-space-indented `- ` bullets) into a tree. */
function parse(text: string): MMNode | null {
  const md = xmindMarkToMarkdown(text)
    .split('\n')
    .filter(l => l.trim());
  if (!md.length) return null;

  let root: MMNode | null = null;
  const stack: { node: MMNode; depth: number }[] = [];

  for (const line of md) {
    const heading = line.match(/^#\s+(.+)/);
    if (heading) {
      root = { title: clamp(heading[1].trim()), children: [], x: 0, y: 0, w: 0, depth: 0, color: '' };
      stack.length = 0;
      stack.push({ node: root, depth: 0 });
      continue;
    }
    const bullet = line.match(/^(\s*)-\s+(.+)/);
    if (!bullet) continue;
    const depth = bullet[1].length / 2 + 1;
    const node: MMNode = { title: clamp(bullet[2].trim()), children: [], x: 0, y: 0, w: 0, depth, color: '' };
    if (!root) {
      root = { title: 'Mind Map', children: [], x: 0, y: 0, w: 0, depth: 0, color: '' };
      stack.push({ node: root, depth: 0 });
    }
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack.length ? stack[stack.length - 1].node : root;
    parent.children.push(node);
    stack.push({ node, depth });
  }
  return root;
}

/** Tidy left-to-right layout: x by column, y by leaf order with parents centered on children. */
function layout(root: MMNode): { width: number; height: number; nodes: MMNode[] } {
  const colWidth: number[] = [];
  const measure = (n: MMNode, depth: number) => {
    const w = textWidth(n.title, fontForDepth(depth)) + PAD_X * 2;
    colWidth[depth] = Math.max(colWidth[depth] ?? 0, w);
    n.children.forEach(c => measure(c, depth + 1));
  };
  measure(root, 0);

  const colX: number[] = [];
  let acc = 0;
  for (let d = 0; d < colWidth.length; d++) {
    colX[d] = acc;
    acc += colWidth[d] + COL_GAP;
  }
  const width = acc - COL_GAP;

  let leaf = 0;
  const place = (n: MMNode, depth: number) => {
    n.depth = depth;
    n.x = colX[depth];
    n.w = textWidth(n.title, fontForDepth(depth)) + PAD_X * 2;
    if (!n.children.length) {
      n.y = leaf * ROW_H;
      leaf += 1;
    } else {
      n.children.forEach(c => place(c, depth + 1));
      n.y = (n.children[0].y + n.children[n.children.length - 1].y) / 2;
    }
  };
  place(root, 0);

  // Colour assignment mirrors markmap: cycle the palette in pre-order traversal.
  const nodes: MMNode[] = [];
  let ci = 0;
  const collect = (n: MMNode) => {
    n.color = PALETTE[ci++ % PALETTE.length];
    nodes.push(n);
    n.children.forEach(collect);
  };
  collect(root);

  return { width, height: Math.max(leaf, 1) * ROW_H, nodes };
}

/**
 * The pixel width the diagram will occupy for `text`, capped at `maxWidth`.
 * Lets the share card size every module to one consistent content width.
 */
export function mindMapRenderWidth(text: string, maxWidth = 1080): number {
  const root = parse(text);
  if (!root) return 0;
  const { width } = layout(root);
  const vbW = width + MARGIN * 2;
  return Math.round(vbW * Math.min(1, maxWidth / vbW));
}

export const MindMapDiagram: React.FC<{ text: string; maxWidth?: number }> = ({ text, maxWidth = 1080 }) => {
  const root = React.useMemo(() => parse(text), [text]);
  if (!root) return null;

  const { width, height, nodes } = layout(root);
  const vbW = width + MARGIN * 2;
  const vbH = height + MARGIN * 2 + 8;

  // Render at the diagram's *native* pixel size (so labels keep their full
  // font size and stay crisp when the share image is enlarged), only scaling
  // down when the map is wider than the allotted space. Previously the SVG was
  // forced to `width="100%"`, which squeezed wide maps into the narrow card and
  // made the rasterized text tiny and blurry.
  const scale = Math.min(1, maxWidth / vbW);
  const renderW = Math.round(vbW * scale);
  const renderH = Math.round(vbH * scale);

  const left = (n: MMNode) => MARGIN + n.x;
  // Connectors and underlines meet at the bottom edge of each node, as in markmap.
  const baseY = (n: MMNode) => MARGIN + n.y + nodeH(n);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${vbW} ${vbH}`}
      width={renderW}
      height={renderH}
      style={{ display: 'block', maxWidth: '100%' }}
      fontFamily='-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    >
      {/* connectors — coloured by the child branch, like markmap links */}
      {nodes.flatMap(n =>
        n.children.map(c => {
          const x1 = left(n) + n.w;
          const y1 = baseY(n);
          const x2 = left(c);
          const y2 = baseY(c);
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={`${n.title}-${c.title}-${c.x}-${c.y}`}
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none"
              stroke={c.color}
              strokeWidth={lineForDepth(c.depth)}
              strokeLinecap="round"
            />
          );
        }),
      )}

      {/* nodes — text label sitting on a coloured underline */}
      {nodes.map(n => {
        const x = left(n);
        const by = baseY(n);
        const fs = fontForDepth(n.depth);
        return (
          <g key={`${n.title}-${n.x}-${n.y}`}>
            <line
              x1={x}
              y1={by}
              x2={x + n.w}
              y2={by}
              stroke={n.color}
              strokeWidth={lineForDepth(n.depth)}
              strokeLinecap="round"
            />
            {n.children.length > 0 && (
              <circle cx={x + n.w} cy={by} r={lineForDepth(n.depth) + 1.5} fill={n.color} />
            )}
            <text
              x={x + PAD_X}
              y={by - PAD_Y - fs * 0.34}
              dominantBaseline="central"
              fontSize={fs}
              fontWeight={n.depth === 0 ? 700 : n.depth === 1 ? 600 : 500}
              fill="#1d1d1f"
            >
              {n.title}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
