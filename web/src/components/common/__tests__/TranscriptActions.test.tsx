import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TranscriptActions, TranscriptRefreshButton } from '../TranscriptActions'

const setup = (overrides: Partial<Parameters<typeof TranscriptActions>[0]> = {}) => {
  const props = {
    onCopy: vi.fn(),
    onDownload: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  }
  render(<TranscriptActions {...props} />)
  return props
}

describe('TranscriptActions', () => {
  it('shows the three controls collapsed', () => {
    setup()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    expect(screen.queryByText('Copy with timestamp')).not.toBeInTheDocument()
  })

  it('offers both copy variants and reports which was chosen', async () => {
    const { onCopy } = setup()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /^copy$/i }))
    await user.click(screen.getByText('Copy with timestamp'))
    expect(onCopy).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole('button', { name: /^copy$/i }))
    await user.click(screen.getByText('Copy without timestamp'))
    expect(onCopy).toHaveBeenLastCalledWith(false)
  })

  it.each([
    ['TXT with timestamps', 'txt', true],
    ['TXT without timestamps', 'txt', false],
    ['SRT with timestamps', 'srt', true],
    ['SRT without timestamps', 'srt', false],
  ])('downloads %s as %s/%s', async (label, format, withTimestamps) => {
    const { onDownload } = setup()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /download/i }))
    await user.click(screen.getByText(label))

    expect(onDownload).toHaveBeenCalledWith(format, withTimestamps)
  })

  it('closes the menu once a choice is made', async () => {
    setup()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /^copy$/i }))
    await user.click(screen.getByText('Copy with timestamp'))

    expect(screen.queryByText('Copy with timestamp')).not.toBeInTheDocument()
  })

  it('opening one menu closes the other', async () => {
    setup()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /^copy$/i }))
    expect(screen.getByText('Copy with timestamp')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /download/i }))
    expect(screen.queryByText('Copy with timestamp')).not.toBeInTheDocument()
    expect(screen.getByText('TXT with timestamps')).toBeInTheDocument()
  })

  it('closes an open menu on a click outside it', async () => {
    setup()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /^copy$/i }))
    expect(screen.getByText('Copy with timestamp')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByText('Copy with timestamp')).not.toBeInTheDocument()
  })

  it('refreshes without opening anything', async () => {
    const { onRefresh } = setup()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /refresh/i }))

    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('disables refresh while it is running', () => {
    setup({ isRefreshing: true })
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled()
  })
})

describe('TranscriptRefreshButton', () => {
  it('reads "Refresh" by default', () => {
    render(<TranscriptRefreshButton onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: /refresh/i })).toBeEnabled()
  })

  it('takes a label, so a failed load can offer "Retry"', () => {
    render(<TranscriptRefreshButton onClick={vi.fn()} label="Retry" />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('reports the click', async () => {
    const onClick = vi.fn()
    render(<TranscriptRefreshButton onClick={onClick} />)

    await userEvent.setup().click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledOnce()
  })
})
