import { describe, it, expect } from 'vitest';
import { Transformer } from 'markmap-lib';
import { xmindMarkToMarkdown } from '../xmindMarkdown';

// The string-level rules live in packages/core's own tests. What matters here is what markmap
// actually builds from the markdown we hand it: a bullet indented further than its parent can
// hold is an indented code block, and a whole branch then renders as one grey <pre> node
// instead of a tree.
const transformer = new Transformer();

function nodes(outline: string): string[] {
  const { root } = transformer.transform(xmindMarkToMarkdown(outline));
  const out: string[] = [];
  (function walk(node: any) {
    out.push(String(node.content));
    (node.children ?? []).forEach(walk);
  })(root);
  return out;
}

const OUTLINES: Record<string, string> = {
  'as prompted, 4 spaces per level': 'Root\n- Main\n    - Sub\n        - Detail\n- Main 2',
  'two-space steps': 'Root\n- Main\n  - Sub\n    - Detail',
  'three-space steps': 'Root\n- Main\n   - Sub\n      - Detail',
  'a skipped level': 'Root\n- Main\n            - Detail\n- Main 2',
  'tab indents': 'Root\n- Main\n\t- Sub\n\t\t- Detail',
  'a branch line that lost its dash': 'Root\nMain Branch\n        - Sub\n            - Detail\n        - Sub 2',
  'no root line at all': '- Main\n    - Sub',
};

describe('mind map markdown → markmap', () => {
  for (const [name, outline] of Object.entries(OUTLINES)) {
    it(`renders ${name} as separate nodes`, () => {
      const contents = nodes(outline);
      expect(contents.some((c) => c.includes('<pre'))).toBe(false);
      // A node holding a <br> is several outline lines markdown folded into one — the other
      // half of the same over-indentation bug.
      expect(contents.some((c) => c.includes('<br'))).toBe(false);
      // Every bullet in the source is its own node, none swallowed by the line above it.
      // (Lines with no dash are dropped by the converter, so only bullets are checked.)
      const titles = outline
        .split('\n')
        .filter((l) => /^\s*-\s+/.test(l))
        .map((l) => l.replace(/^\s*-\s+/, '').trim());
      for (const title of titles) expect(contents).toContain(title);
    });
  }

  it('keeps the branch structure of a well-formed outline', () => {
    const { root } = transformer.transform(
      xmindMarkToMarkdown('Root\n- Main\n    - Sub\n        - Detail\n- Main 2'),
    );
    expect(root.content).toBe('Root');
    expect(root.children.map((c: any) => c.content)).toEqual(['Main', 'Main 2']);
    expect(root.children[0].children[0].content).toBe('Sub');
    expect(root.children[0].children[0].children[0].content).toBe('Detail');
  });
});
