import React, { useEffect, useRef } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';

const transformer = new Transformer();

/** Converts XMind-style outline text (JSON tree or indented bullets) into markmap markdown. */
export function xmindMarkToMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{')) {
    try {
      const tree = JSON.parse(trimmed) as { title: string; children?: any[] };
      const toMd = (node: { title: string; children?: any[] }, depth = 0): string => {
        if (depth === 0) {
          const kids = (node.children ?? []).map(c => toMd(c, 1)).join('\n');
          return `# ${node.title}${kids ? '\n' + kids : ''}`;
        }
        const indent = '  '.repeat(depth - 1);
        const line = `${indent}- ${node.title}`;
        const kids = (node.children ?? []).map(c => toMd(c, depth + 1)).join('\n');
        return kids ? `${line}\n${kids}` : line;
      };
      return toMd(tree);
    } catch { /* fall through */ }
  }
  const lines = trimmed.split('\n').map(l => l.replace(/\t/g, '    '));
  const out: string[] = [];
  let rootFound = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (!rootFound && !bulletMatch) { out.push(`# ${line.trim()}`); rootFound = true; }
    else if (bulletMatch) {
      rootFound = true;
      const depth = Math.floor(bulletMatch[1].length / 4);
      const title = bulletMatch[2].replace(/\s*\[[^\]]+\]/g, '').trim();
      out.push('  '.repeat(depth) + `- ${title}`);
    }
  }
  return out.join('\n');
}

/** Renders a mind-map SVG with no StudyContext dependency (used on the public share page). */
export const MarkmapView: React.FC<{ text: string }> = ({ text }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const markdown = xmindMarkToMarkdown(text);
    const { root } = transformer.transform(markdown);
    if (mmRef.current) {
      mmRef.current.setData(root);
      requestAnimationFrame(() => mmRef.current?.fit());
    } else {
      mmRef.current = Markmap.create(svg, {}, root);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        mmRef.current?.fit();
        svg.style.opacity = '1';
      }));
    }
  }, [text]);

  useEffect(() => () => { mmRef.current?.destroy(); mmRef.current = null; }, []);

  return (
    <svg ref={svgRef} className="w-full" style={{ height: '420px', opacity: 0, transition: 'opacity 0.2s ease' }} />
  );
};
