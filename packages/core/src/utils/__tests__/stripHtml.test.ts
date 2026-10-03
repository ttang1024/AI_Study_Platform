import { describe, it, expect } from 'vitest'
import { stripHtml, stripHtmlInline } from '../stripHtml'

describe('stripHtml', () => {
  it('converts block-level closing tags to newlines', () => {
    expect(stripHtml('<p>First</p><p>Second</p>')).toBe('First\nSecond')
  })

  it('converts <br> to a newline', () => {
    expect(stripHtml('Line one<br/>Line two<br>Line three')).toBe('Line one\nLine two\nLine three')
  })

  it('strips remaining tags', () => {
    expect(stripHtml('<div><strong>Bold</strong> text</div>')).toBe('Bold text')
  })

  it('decodes known HTML entities', () => {
    expect(stripHtml('Tom &amp; Jerry &lt;3 &quot;fun&quot;')).toBe('Tom & Jerry <3 "fun"')
  })

  it('leaves unknown entities untouched', () => {
    expect(stripHtml('&unknown;')).toBe('&unknown;')
  })

  it('collapses 3+ consecutive newlines to 2', () => {
    expect(stripHtml('A</p></div></h1>B')).toBe('A\n\nB')
  })

  it('trims leading/trailing whitespace', () => {
    expect(stripHtml('  <p>content</p>  ')).toBe('content')
  })
})

describe('stripHtmlInline', () => {
  it('collapses newlines and whitespace into single spaces', () => {
    expect(stripHtmlInline('<p>First</p><p>Second</p>')).toBe('First Second')
  })
})
