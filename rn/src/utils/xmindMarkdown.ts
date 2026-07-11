// Ports web/src/components/mindmap/xmindMarkdown.ts — converts a stored mind map's
// raw text (XMindMark outline, or legacy JSON tree) into markmap-compatible markdown.

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

  for (const line of lines) {
    if (!line.trim()) continue;
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (!rootFound && !bulletMatch) {
      out.push(`# ${line.trim()}`);
      rootFound = true;
    } else if (bulletMatch) {
      rootFound = true;
      const depth = Math.floor(bulletMatch[1].length / 4);
      const title = bulletMatch[2].replace(/\s*\[[^\]]+\]/g, '').trim();
      out.push('  '.repeat(depth) + `- ${title}`);
    }
  }

  return out.join('\n');
}
