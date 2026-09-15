import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StudyTabBar } from '../StudyTabBar'
import { TABS } from '../../../constants/tab'

describe('StudyTabBar', () => {
  it('shows every study tab', () => {
    render(<StudyTabBar activeTab="summary" onSelect={vi.fn()} />)

    for (const tab of TABS) {
      expect(screen.getByRole('button', { name: new RegExp(tab.label, 'i') })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button')).toHaveLength(TABS.length)
  })

  it('reports the tab that was clicked', async () => {
    const onSelect = vi.fn()
    render(<StudyTabBar activeTab="summary" onSelect={onSelect} />)

    await userEvent.setup().click(screen.getByRole('button', { name: /quiz/i }))

    expect(onSelect).toHaveBeenCalledWith('quiz')
  })

  it('marks only the active tab', () => {
    render(<StudyTabBar activeTab="notes" onSelect={vi.fn()} />)

    const active = screen.getByRole('button', { name: /notes/i })
    expect(active.className).toContain('border-[var(--primary)]')

    const inactive = screen.getByRole('button', { name: /quiz/i })
    expect(inactive.className).toContain('border-transparent')
  })

  it('moves the marker when the active tab changes', () => {
    const { rerender } = render(<StudyTabBar activeTab="notes" onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /notes/i }).className).toContain('border-[var(--primary)]')

    rerender(<StudyTabBar activeTab="chat" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: /notes/i }).className).toContain('border-transparent')
    expect(screen.getByRole('button', { name: /ai chat/i }).className).toContain('border-[var(--primary)]')
  })
})
