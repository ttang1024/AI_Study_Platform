import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RenameModal } from '../RenameModal'

const setup = (overrides: Partial<Parameters<typeof RenameModal>[0]> = {}) => {
  const props = {
    isOpen: true,
    title: 'Edit file name',
    label: 'File name',
    value: 'Notes.pdf',
    onChange: vi.fn(),
    onClose: vi.fn(),
    onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    ...overrides,
  }
  render(<RenameModal {...props} />)
  return props
}

describe('RenameModal', () => {
  it('renders nothing when closed', () => {
    setup({ isOpen: false })
    expect(screen.queryByText('Edit file name')).not.toBeInTheDocument()
  })

  it('shows the heading, field label and current value', () => {
    setup()
    expect(screen.getByText('Edit file name')).toBeInTheDocument()
    expect(screen.getByText('File name')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('Notes.pdf')
  })

  it('reports each edit', async () => {
    const { onChange } = setup({ value: '' })

    await userEvent.setup().type(screen.getByRole('textbox'), 'A')

    expect(onChange).toHaveBeenCalledWith('A')
  })

  it('submits on Save', async () => {
    const { onSubmit } = setup()

    await userEvent.setup().click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('closes on Cancel without submitting', async () => {
    const { onClose, onSubmit } = setup()

    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a validation error next to the field', () => {
    setup({ error: 'Name is already taken.' })
    expect(screen.getByText('Name is already taken.')).toBeInTheDocument()
  })

  it('locks both buttons while saving, so a rename cannot be double-submitted', () => {
    setup({ isSaving: true })
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })
})
