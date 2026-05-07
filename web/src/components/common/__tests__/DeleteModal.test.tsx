import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DeleteModal } from '../DeleteModal'

describe('DeleteModal', () => {
  it('renders nothing when closed', () => {
    render(<DeleteModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument()
  })

  it('shows default title and confirmation text', () => {
    render(<DeleteModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText('Delete item')).toBeInTheDocument()
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()
  })

  it('shows itemName in the confirmation message', () => {
    render(
      <DeleteModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} itemName="My Document" />,
    )
    expect(screen.getByText('"My Document"')).toBeInTheDocument()
  })

  it('calls onConfirm when Delete button is clicked', async () => {
    const onConfirm = vi.fn()
    render(<DeleteModal isOpen onClose={vi.fn()} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onClose when Cancel is clicked and not deleting', async () => {
    const onClose = vi.fn()
    render(<DeleteModal isOpen onClose={onClose} onConfirm={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when isDeleting and Cancel is clicked', async () => {
    const onClose = vi.fn()
    render(
      <DeleteModal isOpen isDeleting onClose={onClose} onConfirm={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows spinner and disables Delete button when isDeleting', () => {
    render(<DeleteModal isOpen isDeleting onClose={vi.fn()} onConfirm={vi.fn()} />)
    const deleteBtn = screen.getByRole('button', { name: 'Delete' })
    expect(deleteBtn).toBeDisabled()
    expect(deleteBtn.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('uses custom confirmLabel and cancelLabel', () => {
    render(
      <DeleteModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Remove"
        cancelLabel="Keep"
      />,
    )
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument()
  })
})
