import { describe, expect, it, vi } from 'vitest'
import { parseInertHtml, sanitizeHtml } from '../sanitizeHtml'

describe('sanitizeHtml', () => {
  it('keeps rich-text formatting', () => {
    const html = '<h2>Title</h2><p><strong>bold</strong> <a href="https://x.dev">link</a></p><ul><li>a</li></ul>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('drops script, event handlers and javascript: URLs', () => {
    const out = sanitizeHtml(
      '<p>hi<img src=x onerror="alert(1)"><script>steal()</script><a href="javascript:alert(1)">x</a></p>',
    )
    expect(out).not.toMatch(/onerror|<script|javascript:/i)
    expect(out).toContain('hi')
  })
})

describe('parseInertHtml', () => {
  it('does not run handlers in the parsed markup', () => {
    const spy = vi.fn()
    ;(window as unknown as { __xss: () => void }).__xss = spy
    const doc = parseInertHtml('<section><img src="x" onerror="window.__xss()"><p>text</p></section>')
    expect(doc.querySelector('section')?.textContent).toBe('text')
    expect(spy).not.toHaveBeenCalled()
  })
})
