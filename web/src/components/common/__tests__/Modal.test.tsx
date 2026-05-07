import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from '../Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>,
    )
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders title and children when open', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="My Modal">
        <p>Body text</p>
      </Modal>,
    )
    expect(screen.getByText('My Modal')).toBeInTheDocument()
    expect(screen.getByText('Body text')).toBeInTheDocument()
  })

  it('calls onClose when the X button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Close me">
        <p>Content</p>
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal isOpen onClose={onClose} title="Backdrop">
        <p>Content</p>
      </Modal>,
    )
    const backdrop = container.querySelector('.absolute.inset-0') as HTMLElement
    await userEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
