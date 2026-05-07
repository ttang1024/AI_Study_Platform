import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from '../Pagination'

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders page numbers', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument()
  })

  it('calls onPageChange with next page when Next is clicked', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />)
    const buttons = screen.getAllByRole('button')
    const nextBtn = buttons[buttons.length - 1]
    await userEvent.click(nextBtn)
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('calls onPageChange with previous page when Prev is clicked', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />)
    const buttons = screen.getAllByRole('button')
    const prevBtn = buttons[0]
    await userEvent.click(prevBtn)
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('disables prev button on first page', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(<Pagination page={3} totalPages={3} onPageChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[buttons.length - 1]).toBeDisabled()
  })

  it('calls onPageChange when a page number is clicked', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={3} onPageChange={onPageChange} />)
    await userEvent.click(screen.getByRole('button', { name: '2' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('shows a label when provided', () => {
    render(
      <Pagination page={1} totalPages={3} onPageChange={vi.fn()} label="Showing 1-10 of 30" />,
    )
    expect(screen.getByText('Showing 1-10 of 30')).toBeInTheDocument()
  })
})
