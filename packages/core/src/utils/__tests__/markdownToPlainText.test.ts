import { describe, it, expect } from 'vitest'
import { markdownToPlainText } from '../markdownToPlainText'

describe('markdownToPlainText', () => {
  it('replaces fenced code blocks with a placeholder', () => {
    expect(markdownToPlainText('before\n```js\nconst x = 1;\n```\nafter')).toBe('before code block omitted. after')
  })

  it('unwraps inline code', () => {
    expect(markdownToPlainText('use `foo()` here')).toBe('use foo() here')
  })

  it('drops images entirely', () => {
    expect(markdownToPlainText('text ![alt](img.png) more')).toBe('text more')
  })

  it('keeps link text and drops the URL', () => {
    expect(markdownToPlainText('see [the docs](https://example.com)')).toBe('see the docs')
  })

  it('strips heading markers', () => {
    expect(markdownToPlainText('## Heading\nBody')).toBe('Heading\nBody')
  })

  it('unwraps bold and italics', () => {
    expect(markdownToPlainText('**bold** and _italic_ and *also italic*')).toBe('bold and italic and also italic')
  })

  it('strips list bullets and ordered markers', () => {
    expect(markdownToPlainText('- one\n- two\n1. three')).toBe('one\ntwo\nthree')
  })

  it('strips blockquote markers', () => {
    expect(markdownToPlainText('> quoted line')).toBe('quoted line')
  })

  it('replaces table pipes with spaces', () => {
    expect(markdownToPlainText('a | b | c')).toBe('a b c')
  })

  it('collapses excess whitespace', () => {
    expect(markdownToPlainText('a   b\t\tc')).toBe('a b c')
  })
})
