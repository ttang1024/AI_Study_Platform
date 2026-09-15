import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArticleReader } from '../ArticleReader'
import type { Document } from '../../../types'

const doc: Document = {
  id: 'doc-1',
  name: 'Clipped.md',
  type: 'md' as Document['type'],
  url: '',
  uploadDate: '2026-09-01T00:00:00.000Z',
  courseId: 'course-1',
  originalUrl: 'https://example.test/clipped',
}

function renderWithBody(markdown: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => markdown }))
  return render(<ArticleReader document={doc} onTextSelect={() => {}} />)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ArticleReader', () => {
  it('keeps prose dollar amounts as prose', async () => {
    // remark-math pairs the two prices into one span; the "%" inside it would then comment
    // out the rest of the sentence.
    const { container } = renderWithBody('Plans start at $9 (about 20% off) and go to $99 per month.')

    await waitFor(() =>
      expect(screen.getByText('Plans start at $9 (about 20% off) and go to $99 per month.')).toBeInTheDocument()
    )
    expect(container.querySelector('.katex')).toBeNull()
  })

  it('keeps rendering the inline math the clipper writes', async () => {
    // Every article already in the library delimits formulas with a single "$".
    const { container } = renderWithBody('The residual $F(x)$ is what the block learns.')

    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull())
    expect(container.textContent).not.toContain('$F(x)$')
  })

  it('does not let a language-less fence keep the inline-code chip styling', async () => {
    // The clipper writes "```" with no language for a <pre> that had none, and react-markdown
    // then hands the `code` renderer the same props inline code gets — so the chip's near-white
    // background landed under the <pre>'s white text. Asserted on classes because that is where
    // the styling lives; jsdom does not compile Tailwind, so computed colours say nothing here.
    const { container } = renderWithBody('```\nprint("hello")\n```')

    await waitFor(() => expect(container.querySelector('pre code')).not.toBeNull())
    const pre = container.querySelector('pre')!
    expect(pre.className).toContain('[&_code]:bg-transparent')
    expect(pre.className).toContain('[&_code]:text-inherit')
  })

  it('renders display math', async () => {
    const { container } = renderWithBody('Before\n\n$$\nE = mc^2\n$$\n\nAfter')

    await waitFor(() => expect(container.querySelector('.katex-display')).not.toBeNull())
  })
})
