/**
 * Undoes remark-math's `$…$` spans when the dollar signs were prices, not delimiters.
 *
 * A clipped web article is prose, and prose has money in it. remark-math pairs up any two
 * `$` in a paragraph, so "plans start at $9 (about 20% off) and go to $99 per month" becomes
 * one math span holding "9 (about 20% off) and go to " — and KaTeX then reads the bare `%`
 * as a LaTeX comment and drops everything after it, so the sentence loses its middle. That
 * is the `commentAtEnd` warning; a mis-encoded character caught in the same span produces
 * the `unknownSymbol` one.
 *
 * Turning single-dollar math off entirely is not an option: the clipper writes real inline
 * formulas as `$H(x)$`, and every article already in the library uses them.
 *
 * So the spans are filtered instead, on two signals:
 *
 *  - pandoc's rule — a closing `$` immediately followed by a digit is a price. That is what
 *    separates "$9 … $99 per month" from "$H(x)$ is the mapping".
 *  - a `%` that is not `\%`. Valid TeX escapes its percent signs; an unescaped one means the
 *    span was never a formula, and rendering it would eat the rest of the line.
 *
 * A span that trips either one is put back as the literal source text it was cut from.
 */

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

const UNESCAPED_PERCENT = /(^|[^\\])%/;

function looksLikeProse(node: MdNode, next: MdNode | undefined): boolean {
  if (next?.type === 'text' && /^\d/.test(next.value ?? '')) return true;
  return UNESCAPED_PERCENT.test(node.value ?? '');
}

/** The exact `$…$` the span was parsed from, so `$$…$$` round-trips too. */
function sourceText(node: MdNode, source: string): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (typeof start === 'number' && typeof end === 'number') return source.slice(start, end);
  return `$${node.value ?? ''}$`;
}

function unwrap(parent: MdNode, source: string): void {
  const children = parent.children;
  if (!children) return;

  const out: MdNode[] = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === 'inlineMath' && looksLikeProse(child, children[i + 1])) {
      const previous = out[out.length - 1];
      const text = sourceText(child, source);
      // Merge into the preceding text node so the paragraph stays one run of text.
      if (previous?.type === 'text') previous.value = (previous.value ?? '') + text;
      else out.push({ type: 'text', value: text });
      continue;
    }
    const previous = out[out.length - 1];
    if (child.type === 'text' && previous?.type === 'text') {
      previous.value = (previous.value ?? '') + (child.value ?? '');
      continue;
    }
    out.push(child);
    unwrap(child, source);
  }
  parent.children = out;
}

export function remarkProseDollars() {
  return (tree: MdNode, file: { value?: unknown }) => {
    unwrap(tree, String(file.value ?? ''));
  };
}
