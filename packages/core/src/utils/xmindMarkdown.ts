// Converts a stored mind map's raw text (XMindMark outline, or legacy JSON tree)
// into markmap-compatible markdown.

interface TreeNode {
  title: string;
  children?: TreeNode[];
}

function legacyJsonToTree(text: string): TreeNode | null {
  try {
    return JSON.parse(text) as TreeNode;
  } catch {
    return null;
  }
}

function treeNodeToMarkdown(node: TreeNode, depth = 0): string {
  if (depth === 0) {
    const childLines = (node.children ?? []).map((c) => treeNodeToMarkdown(c, 1)).join('\n');
    return `# ${node.title}${childLines ? '\n' + childLines : ''}`;
  }
  const indent = '  '.repeat(depth - 1);
  const line = `${indent}- ${node.title}`;
  const childLines = (node.children ?? []).map((c) => treeNodeToMarkdown(c, depth + 1)).join('\n');
  return childLines ? `${line}\n${childLines}` : line;
}

export function xmindMarkToMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{')) {
    const tree = legacyJsonToTree(trimmed);
    if (tree) return treeNodeToMarkdown(tree);
  }

  const lines = trimmed.split('\n').map((l) => l.replace(/\t/g, '    '));
  const out: string[] = [];
  let rootFound = false;
  // The indent widths of the branches we are currently inside, outermost first. Emitted depth
  // is this stack's height, never the source indent divided by a fixed step: the model is asked
  // for 4 spaces per level but returns 2- and 3-space steps, skips levels, and sometimes drops
  // the dash from a branch line (which we discard, orphaning its children at their original
  // depth). Any of those used to emit a bullet indented further than its parent can hold, and
  // markdown reads that as an indented code block, not as nesting — that is how a whole subtree
  // collapsed into a single grey <pre> node in the viewer. Deriving depth from the enclosing
  // branches keeps every child exactly one level below its parent whatever the source did.
  const openIndents: number[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    // Fences the model was told not to emit but sometimes does; without this the opening one
    // would be taken for the root topic.
    if (/^\s*(```|~~~)/.test(line)) continue;

    const bulletMatch = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.+)/);
    if (!rootFound && !bulletMatch) {
      out.push(`# ${line.trim().replace(/^#+\s*/, '')}`);
      rootFound = true;
      continue;
    }
    if (!bulletMatch) continue;

    rootFound = true;
    const indent = bulletMatch[1].length;
    while (openIndents.length && openIndents[openIndents.length - 1] >= indent) openIndents.pop();
    openIndents.push(indent);
    const title = bulletMatch[2].replace(/\s*\[[^\]]+\]/g, '').trim();
    out.push('  '.repeat(openIndents.length - 1) + `- ${title}`);
  }

  return out.join('\n');
}
