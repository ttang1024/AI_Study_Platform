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
import { I18nProvider } from '../../../i18n'

const EVERYTHING_ROW = /search everything for/i

describe('GlobalSearch — search-everything escape hatch', () => {
  beforeEach(() => { navigate.mockClear(); localStorage.clear() })

  const open = () => render(<I18nProvider><GlobalSearch isOpen onClose={vi.fn()} /></I18nProvider>)
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

describe('GlobalSearch — go-to-page commands', () => {
  beforeEach(() => { navigate.mockClear(); localStorage.clear() })

  const open = () => render(<I18nProvider><GlobalSearch isOpen onClose={vi.fn()} /></I18nProvider>)

  it('lists navigation commands when the query is empty', () => {
    open()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Library')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('opens the first command with Enter alone', async () => {
    open()
    await userEvent.type(screen.getByRole('textbox'), '{Enter}')
    expect(navigate).toHaveBeenCalledWith('/dashboard')
  })

  it('filters commands as the user types and navigates on select', async () => {
    open()
    await userEvent.type(screen.getByRole('textbox'), 'leech')
    await userEvent.click(screen.getByText(/Leeches/))
    expect(navigate).toHaveBeenCalledWith('/flashcards?tab=leeches')
  })
})

describe('GlobalSearch — recent items', () => {
  beforeEach(() => { navigate.mockClear(); localStorage.clear() })

  const open = () => render(<I18nProvider><GlobalSearch isOpen onClose={vi.fn()} /></I18nProvider>)

  it('does not show a Recent section on a clean history', () => {
    open()
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.getByText('Go to page')).toBeInTheDocument()
  })

  it('selecting a content result records it, and it resurfaces first next time the palette opens', async () => {
    const { unmount } = open()
    await userEvent.type(screen.getByRole('textbox'), 'photosynthesis')
    await userEvent.click(screen.getByText('Photosynthesis notes'))
    expect(navigate).toHaveBeenCalledWith('/documents/doc-1')
    unmount()

    open()
    expect(screen.getByText('Recent')).toBeInTheDocument()
    const recentRow = screen.getByText('Photosynthesis notes').closest('button')!
    expect(recentRow).toBeInTheDocument()

    // It is also the default Enter target, ahead of every nav command.
    navigate.mockClear()
    await userEvent.type(screen.getByRole('textbox'), '{Enter}')
    expect(navigate).toHaveBeenCalledWith('/documents/doc-1')
  })

  it('selecting a nav command does not pollute recent-item history', async () => {
    const { unmount } = open()
    await userEvent.type(screen.getByRole('textbox'), '{Enter}') // Dashboard, the first nav command
    unmount()

    open()
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
  })
})
