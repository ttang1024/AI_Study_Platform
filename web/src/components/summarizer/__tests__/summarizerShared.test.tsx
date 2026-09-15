import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { createRef } from 'react'
import { FileDropZone, RecentDocuments, StartLearningLabel } from '../summarizerShared'
import type { Document } from '../../../types'

// The card pulls in the study context and has its own tests; this suite is about the strip
// around it — the empty case, the heading, and one card per document.
vi.mock('../../common/DocumentCard', () => ({
  DocumentCard: ({ doc }: { doc: Document }) => <div data-testid="document-card">{doc.name}</div>,
}))

describe('StartLearningLabel', () => {
  it('invites the upload when nothing is in flight', () => {
    render(<StartLearningLabel busy={false} />)
    expect(screen.getByText('Start Learning')).toBeInTheDocument()
  })

  it('shows progress while working', () => {
    render(<StartLearningLabel busy />)
    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('says so when the file is already in the library', () => {
    render(<StartLearningLabel busy={false} duplicate={{ id: 'doc-1' }} />)
    expect(screen.getByText('Already in Library')).toBeInTheDocument()
  })

  it('prefers progress over the duplicate notice', () => {
    render(<StartLearningLabel busy duplicate={{ id: 'doc-1' }} />)
    expect(screen.getByText('Processing...')).toBeInTheDocument()
    expect(screen.queryByText('Already in Library')).not.toBeInTheDocument()
  })
})

describe('FileDropZone', () => {
  const setup = (overrides: Partial<Parameters<typeof FileDropZone>[0]> = {}) => {
    const props = {
      hasFile: false,
      isDragging: false,
      onDraggingChange: vi.fn(),
      onFile: vi.fn(),
      accept: 'application/pdf',
      inputRef: createRef<HTMLInputElement>(),
      children: <p>Drop a file</p>,
      ...overrides,
    }
    const { container } = render(<FileDropZone {...props} />)
    return { ...props, container }
  }

  const fileInput = (container: HTMLElement) =>
    container.querySelector('input[type="file"]') as HTMLInputElement

  it('renders its content and a file input constrained to the accepted types', () => {
    const { container } = setup()
    expect(screen.getByText('Drop a file')).toBeInTheDocument()
    expect(fileInput(container)).toHaveAttribute('accept', 'application/pdf')
  })

  it('reports a picked file', async () => {
    const { container, onFile } = setup()
    const file = new File(['x'], 'notes.pdf', { type: 'application/pdf' })

    await userEvent.setup().upload(fileInput(container), file)

    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('reports a dropped file and ends the drag', () => {
    const { container, onFile, onDraggingChange } = setup()
    const file = new File(['x'], 'notes.pdf', { type: 'application/pdf' })
    const zone = container.firstElementChild as HTMLElement

    const event = new Event('drop', { bubbles: true })
    Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } })
    zone.dispatchEvent(event)

    expect(onFile).toHaveBeenCalledWith(file)
    expect(onDraggingChange).toHaveBeenLastCalledWith(false)
  })

  it('highlights while a file is dragged over it', () => {
    const { container } = setup({ isDragging: true })
    expect((container.firstElementChild as HTMLElement).className).toContain('border-primary')
  })

  it('confirms a selected file once one is chosen', () => {
    const { container } = setup({ hasFile: true })
    expect((container.firstElementChild as HTMLElement).className).toContain('border-emerald-400')
  })
})

describe('RecentDocuments', () => {
  const doc = (id: string, name: string): Document => ({
    id,
    name,
    type: 'pdf',
    url: `https://blob.test/${id}`,
    uploadDate: '2026-01-01T00:00:00Z',
    courseId: 'course-1',
  })

  const renderList = (docs: Document[]) =>
    render(
      <MemoryRouter>
        <RecentDocuments docs={docs} getCourse={() => undefined} />
      </MemoryRouter>,
    )

  it('renders nothing when the library is empty', () => {
    const { container } = renderList([])
    expect(container).toBeEmptyDOMElement()
  })

  it('lists the documents under a link to the library', () => {
    renderList([doc('1', 'Thermo.pdf'), doc('2', 'Optics.pdf')])

    expect(screen.getByText('Recent Documents')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view all/i })).toHaveAttribute('href', '/library')
    expect(screen.getAllByTestId('document-card')).toHaveLength(2)
    expect(screen.getByText('Thermo.pdf')).toBeInTheDocument()
    expect(screen.getByText('Optics.pdf')).toBeInTheDocument()
  })
})
