import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CodeFileViewer } from '../CodeFileViewer'
import { TableFileViewer } from '../TableFileViewer'
import { SubtitleViewer } from '../SubtitleViewer'
import { NotebookViewer } from '../NotebookViewer'
import { HtmlFileViewer } from '../HtmlFileViewer'

describe('CodeFileViewer', () => {
  it('numbers every line and keeps the source readable as text', () => {
    render(<CodeFileViewer code={'def f():\n    return 1'} fileName="a.py" />)

    // One row per line, each opening with its line number in the gutter.
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(rows.map(row => within(row).getAllByRole('cell')[0].textContent)).toEqual(['1', '2'])
    expect(screen.getByText(/return/)).toBeInTheDocument()
  })

  it('shows a line count caption by default', () => {
    render(<CodeFileViewer code={'a\nb\nc'} fileName="a.txt" />)
    expect(screen.getByText('3 lines')).toBeInTheDocument()
  })
})

describe('TableFileViewer', () => {
  it('renders a csv as a table with a header row', () => {
    render(<TableFileViewer text={'name,score\nAda,99\nAlan,97'} fileName="grades.csv" />)

    expect(screen.getByRole('columnheader', { name: 'name' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument()
    expect(screen.getByText('2 rows · 2 columns')).toBeInTheDocument()
  })

  it('falls back to the source view when the file is not a grid', () => {
    render(<TableFileViewer text={'just one column\nof prose'} fileName="notes.csv" />)

    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    expect(screen.getByText(/just one column/)).toBeInTheDocument()
  })
})

describe('SubtitleViewer', () => {
  it('lists cues with their start times', () => {
    const srt = '1\n00:00:01,000 --> 00:00:04,000\nHello world\n'
    render(<SubtitleViewer text={srt} fileName="talk.srt" />)

    expect(screen.getByText('0:01')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText(/1 cue$/)).toBeInTheDocument()
  })

  it('shows the raw file when nothing parses as a cue', () => {
    render(<SubtitleViewer text="no cues here" fileName="a.srt" />)
    expect(screen.getByText('no cues here')).toBeInTheDocument()
  })
})

describe('NotebookViewer', () => {
  const notebook = JSON.stringify({
    cells: [
      { cell_type: 'markdown', source: '# Heading' },
      {
        cell_type: 'code',
        source: 'print("hi")',
        execution_count: 1,
        outputs: [{ output_type: 'stream', text: 'hi\n' }],
      },
    ],
    metadata: { language_info: { name: 'python' } },
  })

  it('renders markdown cells, code cells and their outputs', () => {
    render(<NotebookViewer text={notebook} fileName="lab.ipynb" />)

    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    expect(screen.getByText('In [1]')).toBeInTheDocument()
    expect(screen.getByText(/print/)).toBeInTheDocument()
    expect(screen.getByText('hi')).toBeInTheDocument()
  })

  it('falls back to the source view when the json is not a notebook', () => {
    render(<NotebookViewer text={'{"a":1}'} fileName="x.ipynb" />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})

describe('HtmlFileViewer', () => {
  it('renders into a fully sandboxed iframe', () => {
    const { container } = render(<HtmlFileViewer html="<p>Hi</p>" fileName="page.html" />)
    const iframe = container.querySelector('iframe')

    expect(iframe).not.toBeNull()
    // An empty sandbox is what keeps uploaded markup from running scripts or
    // touching our origin; widening it would defeat the whole viewer.
    expect(iframe).toHaveAttribute('sandbox', '')
    expect(iframe).toHaveAttribute('srcdoc', '<p>Hi</p>')
  })

  it('switches to the source view on demand', async () => {
    const { container } = render(<HtmlFileViewer html="<p>Hi</p>" fileName="page.html" />)
    await userEvent.click(screen.getByRole('button', { name: /source/i }))

    expect(container.querySelector('iframe')).toBeNull()
    const table = container.querySelector('table')
    expect(within(table as HTMLElement).getByText(/Hi/)).toBeInTheDocument()
  })
})
