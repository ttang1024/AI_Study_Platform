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

  it('converts tabs to 4-space indents before computing depth', () => {
    const outline = 'Root\n\t- Tabbed child'
    const result = xmindMarkToMarkdown(outline)
    expect(result).toBe('# Root\n  - Tabbed child')
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
