import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuestionBankTab } from '../QuestionBankTab'
import type { QuestionBankQuestion } from '../../../services/questionBankService'

const makeQuestion = (id: string): QuestionBankQuestion => ({
  quizId: id,
  documentId: 'doc-1',
  sourceType: 'document',
  sourceName: 'Chapter 1',
  question: `Question ${id}`,
  options: ['A) One', 'B) Two', 'C) Three', 'D) Four'],
  correctAnswer: 'A',
  explanation: 'Because.',
  difficulty: 'medium',
  createdAt: '2026-01-01T00:00:00Z',
})

const baseProps = {
  courses: [],
  loading: false,
  search: '',
  onSearchChange: vi.fn(),
  courseId: 'all',
  onCourseChange: vi.fn(),
  difficulty: 'all' as const,
  onDifficultyChange: vi.fn(),
  questions: [],
  selectedIds: new Set<string>(),
  onSelect: vi.fn(),
  onSelectFiltered: vi.fn(),
  revealedAnswers: new Set<string>(),
  onToggleAnswer: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
}

describe('QuestionBankTab', () => {
  // ─── totalCount display ──────────────────────────────────────────────────

  it('shows questions.length when totalCount is omitted', () => {
    const questions = [makeQuestion('q-1'), makeQuestion('q-2')]
    render(<QuestionBankTab {...baseProps} questions={questions} />)
    expect(screen.getByText('2 questions')).toBeInTheDocument()
  })

  it('shows totalCount instead of questions.length when provided', () => {
    const questions = [makeQuestion('q-1'), makeQuestion('q-2')]
    render(<QuestionBankTab {...baseProps} questions={questions} totalCount={47} />)
    expect(screen.getByText('47 questions')).toBeInTheDocument()
  })

  it('shows 0 questions when both questions and totalCount are empty/zero', () => {
    render(<QuestionBankTab {...baseProps} questions={[]} totalCount={0} />)
    expect(screen.getByText('0 questions')).toBeInTheDocument()
  })

  // ─── list rendering ──────────────────────────────────────────────────────

  it('renders only the passed questions (page slice)', () => {
    const questions = [makeQuestion('q-1'), makeQuestion('q-2'), makeQuestion('q-3')]
    render(<QuestionBankTab {...baseProps} questions={questions} />)
    expect(screen.getByText('Question q-1')).toBeInTheDocument()
    expect(screen.getByText('Question q-2')).toBeInTheDocument()
    expect(screen.getByText('Question q-3')).toBeInTheDocument()
  })

  it('shows empty state when questions is empty', () => {
    render(<QuestionBankTab {...baseProps} questions={[]} />)
    expect(screen.getByText('No questions found')).toBeInTheDocument()
  })

  // ─── interaction ─────────────────────────────────────────────────────────

  it('calls onSelect when checkbox is clicked', async () => {
    const onSelect = vi.fn()
    const questions = [makeQuestion('q-1')]
    render(<QuestionBankTab {...baseProps} questions={questions} onSelect={onSelect} />)
    await userEvent.click(screen.getByTitle('Select question'))
    expect(onSelect).toHaveBeenCalledWith('q-1')
  })

  it('calls onSelectFiltered when "Select filtered" is clicked', async () => {
    const onSelectFiltered = vi.fn()
    const questions = [makeQuestion('q-1')]
    render(<QuestionBankTab {...baseProps} questions={questions} onSelectFiltered={onSelectFiltered} />)
    await userEvent.click(screen.getByText('Select filtered'))
    expect(onSelectFiltered).toHaveBeenCalledOnce()
  })

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn()
    const question = makeQuestion('q-1')
    render(<QuestionBankTab {...baseProps} questions={[question]} onDelete={onDelete} />)
    await userEvent.click(screen.getByTitle('Delete question'))
    expect(onDelete).toHaveBeenCalledWith(question)
  })

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn()
    const question = makeQuestion('q-1')
    render(<QuestionBankTab {...baseProps} questions={[question]} onEdit={onEdit} />)
    await userEvent.click(screen.getByTitle('Edit question'))
    expect(onEdit).toHaveBeenCalledWith(question)
  })
})
