import { describe, it, expect } from 'vitest';
import { markdownToNoteHtml } from '../markdownToNoteHtml';

describe('markdownToNoteHtml', () => {
  it('renders markdown formatting instead of raw syntax', () => {
    const html = markdownToNoteHtml('# Title\n\nSome **bold** and *italic* with `code`.\n\n- one\n- two');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<ul>');
    expect(html).not.toContain('**');
  });

  it('keeps fenced code blocks', () => {
    expect(markdownToNoteHtml('```js\nconst a = 1;\n```')).toContain('<pre><code class="language-js">const a = 1;\n</code></pre>');
  });

  it('flattens tables into one paragraph per row', () => {
    const html = markdownToNoteHtml('| A | B |\n| - | - |\n| 1 | 2 |');
    expect(html).not.toContain('<table');
    expect(html).toContain('<p><strong>A</strong> | <strong>B</strong></p>');
    expect(html).toContain('<p>1 | 2</p>');
  });

  it('keeps math as LaTeX source', () => {
    const html = markdownToNoteHtml('Inline $x^2$ here.\n\n$$\na_1 + b_1\n$$');
    expect(html).toContain('<p>Inline $x^2$ here.</p>');
    expect(html).toContain('<p>$$a_1 + b_1$$</p>');
    expect(html).not.toContain('<pre>');
  });
});
