import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

// The palette matches against whatever StudyContext has already loaded; one document is enough to
// cover both the "has local results" and "has none" branches.
vi.mock('../../../context/StudyContext', () => ({
  useStudy: () => ({
    documents: [{ id: 'doc-1', name: 'Photosynthesis notes', summary: '' }],
    flashcards: [],
    allNotes: [],
    ensureDocuments: vi.fn(),
    ensureFlashcards: vi.fn(),
    ensureNotes: vi.fn(),
  }),
}))

vi.mock('../../../services/glossaryService', () => ({
  glossaryService: { getAllGlossary: () => Promise.resolve([]) },
}))
vi.mock('../../../services/questionBankService', () => ({
  questionBankService: { getQuestions: () => Promise.resolve([]) },
}))
vi.mock('../../../services/aiService', () => ({
  aiService: { getChatSessions: () => Promise.resolve([]) },
}))

import { GlobalSearch } from '../GlobalSearch'

const EVERYTHING_ROW = /search everything for/i

describe('GlobalSearch — search-everything escape hatch', () => {
  beforeEach(() => navigate.mockClear())

  const open = () => render(<GlobalSearch isOpen onClose={vi.fn()} />)
  const type = (text: string) => userEvent.type(screen.getByRole('textbox'), text)

  it('is hidden until the query is long enough to search', async () => {
    open()
    expect(screen.queryByText(EVERYTHING_ROW)).not.toBeInTheDocument()

    await type('p')
    expect(screen.queryByText(EVERYTHING_ROW)).not.toBeInTheDocument()

    await type('h')
    expect(screen.getByText(EVERYTHING_ROW)).toBeInTheDocument()
  })

  it('offers the server search when nothing local matches', async () => {
    open()
    await type('mitochondria')

    expect(screen.getByText(/nothing loaded here matches/i)).toBeInTheDocument()
    await userEvent.click(screen.getByText(EVERYTHING_ROW))
    expect(navigate).toHaveBeenCalledWith('/search?q=mitochondria')
  })

  it('url-encodes the query', async () => {
    open()
    await type('cell theory & mitosis')
    await userEvent.click(screen.getByText(EVERYTHING_ROW))
    expect(navigate).toHaveBeenCalledWith('/search?q=cell%20theory%20%26%20mitosis')
  })

  it('is reachable with Enter alone when there are no local results', async () => {
    open()
    await type('mitochondria{Enter}')
    expect(navigate).toHaveBeenCalledWith('/search?q=mitochondria')
  })

  it('keeps local results ahead of it — Enter opens the match, ArrowDown reaches the row', async () => {
    open()
    await type('photosynthesis')

    // The document is selected first, so the palette's fast path is unchanged.
    await userEvent.keyboard('{Enter}')
    expect(navigate).toHaveBeenCalledWith('/documents/doc-1')

    navigate.mockClear()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(navigate).toHaveBeenCalledWith('/search?q=photosynthesis')
  })

  it('does not move the selection past the row', async () => {
    open()
    await type('photosynthesis')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')
    expect(navigate).toHaveBeenCalledWith('/search?q=photosynthesis')
  })
})
