import { describe, it, expect } from 'vitest'
import { xmindMarkToMarkdown } from '../xmindMarkdown'

describe('xmindMarkToMarkdown', () => {
  it('returns empty string for blank input', () => {
    expect(xmindMarkToMarkdown('   ')).toBe('')
  })

  it('converts a legacy JSON tree into markdown headings/bullets', () => {
    const json = JSON.stringify({
      title: 'Root',
      children: [
        { title: 'Child A' },
        { title: 'Child B', children: [{ title: 'Grandchild' }] },
      ],
    })
    const result = xmindMarkToMarkdown(json)
    expect(result).toBe('# Root\n- Child A\n- Child B\n  - Grandchild')
  })

  it('falls back to XMindMark outline parsing when JSON is malformed', () => {
    const result = xmindMarkToMarkdown('{not valid json\n- item')
    expect(result).toContain('# {not valid json')
    expect(result).toContain('- item')
  })

  it('parses a plain outline with a root line and dash bullets', () => {
    const outline = 'Root Topic\n- First\n    - Nested\n- Second'
    const result = xmindMarkToMarkdown(outline)
    expect(result).toBe('# Root Topic\n- First\n  - Nested\n- Second')
  })

  it('converts tabs to spaces before computing depth', () => {
    const outline = 'Root\n\t- Tabbed child\n\t\t- Tabbed grandchild'
    const result = xmindMarkToMarkdown(outline)
    expect(result).toBe('# Root\n- Tabbed child\n  - Tabbed grandchild')
  })

  it('nests each bullet one level below its parent whatever the source step is', () => {
    // The prompt asks for 4 spaces per level; models return 2 and 3 just as often.
    expect(xmindMarkToMarkdown('Root\n- A\n  - B\n    - C')).toBe('# Root\n- A\n  - B\n    - C')
    expect(xmindMarkToMarkdown('Root\n- A\n   - B\n      - C')).toBe('# Root\n- A\n  - B\n    - C')
    expect(xmindMarkToMarkdown('Root\n- A\n        - B\n                - C')).toBe('# Root\n- A\n  - B\n    - C')
  })

  it('pulls an orphaned branch back to the top level instead of over-indenting it', () => {
    // A branch line that came back without its dash is dropped, leaving its children indented
    // with no parent to hold them. Emitting them at their original depth made markdown read the
    // subtree as an indented code block, so markmap drew the whole branch as one <pre> node.
    const outline = [
      'GAN Training',
      'Common Failure Modes',
      '        - Mode collapse',
      '            - Vanishing gradients',
      '        - Stabilization Tricks',
    ].join('\n')
    expect(xmindMarkToMarkdown(outline)).toBe(
      '# GAN Training\n- Mode collapse\n  - Vanishing gradients\n- Stabilization Tricks',
    )
  })

  it('reopens a shallower level after a deep one', () => {
    const outline = 'Root\n- A\n    - B\n        - C\n    - D\n- E'
    expect(xmindMarkToMarkdown(outline)).toBe('# Root\n- A\n  - B\n    - C\n  - D\n- E')
  })

  it('treats numbered outlines as nodes', () => {
    expect(xmindMarkToMarkdown('Root\n1. First\n    2. Nested')).toBe('# Root\n- First\n  - Nested')
  })

  it('ignores code fences the model was told not to emit', () => {
    expect(xmindMarkToMarkdown('```markdown\nRoot\n- A\n```')).toBe('# Root\n- A')
  })

  it('does not double up the hash when the root line is already a heading', () => {
    expect(xmindMarkToMarkdown('# Root\n- A')).toBe('# Root\n- A')
  })

  it('strips bracketed tags from bullet titles', () => {
    const outline = 'Root\n- Item [tag]'
    expect(xmindMarkToMarkdown(outline)).toBe('# Root\n- Item')
  })

  it('skips blank lines', () => {
    const outline = 'Root\n\n- Item'
    expect(xmindMarkToMarkdown(outline)).toBe('# Root\n- Item')
  })
})
