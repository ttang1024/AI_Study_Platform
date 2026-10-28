import { describe, expect, it } from 'vitest';
import { createMarkmapTransformer } from '../markmapTransformer';

function contents(markdown: string): string {
  const { root } = createMarkmapTransformer().transform(markdown);
  const out: string[] = [];
  (function walk(node: any) {
    out.push(String(node.content));
    (node.children ?? []).forEach(walk);
  })(root);
  return out.join('\n');
}

describe('createMarkmapTransformer', () => {
  it('renders raw HTML in a mind map as text, not markup', () => {
    // A public share's mind map is attacker-controlled; markmap renders node content as HTML.
    const html = contents('# Root\n- <img src=x onerror="alert(1)">\n- <div style="position:fixed">Sign in</div>');

    expect(html).not.toContain('<img');
    expect(html).not.toContain('<div');
    expect(html).toContain('&lt;img');
  });

  it('still renders markdown formatting', () => {
    expect(contents('# Root\n- **bold** and `code`')).toMatch(/<strong>bold<\/strong>.*<code>code<\/code>/);
  });
});
