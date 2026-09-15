import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ShareLinkResult } from '../ShareLinkResult'

const url = 'https://toto-study.com/s/abc123'

describe('ShareLinkResult', () => {
  it('confirms the link and says what was shared', () => {
    render(<ShareLinkResult shareUrl={url} subtitle="3 terms shared." copied={false} onCopy={vi.fn()} />)

    expect(screen.getByText('Share link created!')).toBeInTheDocument()
    expect(screen.getByText('3 terms shared.')).toBeInTheDocument()
    expect(screen.getByText(url)).toBeInTheDocument()
  })

  it('reports a copy request', async () => {
    const onCopy = vi.fn()
    render(<ShareLinkResult shareUrl={url} subtitle="" copied={false} onCopy={onCopy} />)

    await userEvent.setup().click(screen.getByRole('button', { name: /copy/i }))

    expect(onCopy).toHaveBeenCalledOnce()
  })

  it('acknowledges a completed copy', () => {
    const { rerender } = render(
      <ShareLinkResult shareUrl={url} subtitle="" copied={false} onCopy={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeInTheDocument()

    rerender(<ShareLinkResult shareUrl={url} subtitle="" copied onCopy={vi.fn()} />)

    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
  })

  it('opens the shared page in a new tab without leaking the referrer', () => {
    render(<ShareLinkResult shareUrl={url} subtitle="" copied={false} onCopy={vi.fn()} />)

    const link = screen.getByRole('link', { name: /open shared page/i })
    expect(link).toHaveAttribute('href', url)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
