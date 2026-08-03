import { render, screen } from '@testing-library/react-native';

import { CodeFileView } from '@/components/library/viewers/CodeFileView';
import { NotebookFileView } from '@/components/library/viewers/NotebookFileView';
import { SubtitleFileView } from '@/components/library/viewers/SubtitleFileView';
import { TableFileView } from '@/components/library/viewers/TableFileView';

// `render` is async in @testing-library/react-native 14 — awaiting it is what
// makes `screen` usable; the sync form silently yields a pending promise.

describe('CodeFileView', () => {
  it('numbers every line and highlights the source', async () => {
    // No digits in the source itself, so the gutter numbers are unambiguous.
    await render(<CodeFileView code={'def f():\n    return x'} fileName="a.py" />);

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('def')).toBeTruthy();
    expect(screen.getByText('return')).toBeTruthy();
    expect(screen.getByText('2 lines')).toBeTruthy();
  });

  it('separates keyword, string and comment runs', async () => {
    await render(<CodeFileView code={'return "hi"  # note'} fileName="a.py" />);

    // Each run is its own <Text> so it can carry its own colour.
    expect(screen.getByText('return')).toBeTruthy();
    expect(screen.getByText('"hi"')).toBeTruthy();
    expect(screen.getByText('# note')).toBeTruthy();
  });

  it('drops the phantom line a trailing newline would add', async () => {
    await render(<CodeFileView code={'a = 1\n'} fileName="a.py" />);
    expect(screen.getByText('1 line')).toBeTruthy();
  });

  it('uses the caption when one is given', async () => {
    await render(<CodeFileView code="x = 1" fileName="a.py" caption="In [3]" />);

    expect(screen.getByText('In [3]')).toBeTruthy();
    expect(screen.queryByText('1 line')).toBeNull();
  });
});

describe('TableFileView', () => {
  it('renders a csv as a grid', async () => {
    await render(<TableFileView text={'student,score\nAda,99\nAlan,97'} fileName="grades.csv" />);

    expect(screen.getByText('student')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('99')).toBeTruthy();
    expect(screen.getByText('2 rows · 2 columns')).toBeTruthy();
  });

  it('keeps quoted delimiters inside one cell', async () => {
    await render(<TableFileView text={'name,note\n"Smith, J.",ok'} fileName="x.csv" />);
    expect(screen.getByText('Smith, J.')).toBeTruthy();
  });

  it('falls back to the source view when the file is not a grid', async () => {
    await render(<TableFileView text={'just prose\nmore prose'} fileName="notes.csv" />);

    expect(screen.queryByText(/rows ·/)).toBeNull();
    expect(screen.getByText('just prose')).toBeTruthy();
  });
});

describe('SubtitleFileView', () => {
  it('lists cues with their start times', async () => {
    await render(<SubtitleFileView text={'1\n00:00:01,000 --> 00:00:04,000\nHello world\n'} fileName="a.srt" />);

    expect(screen.getByText('0:01')).toBeTruthy();
    expect(screen.getByText('Hello world')).toBeTruthy();
    expect(screen.getByText('1 cue')).toBeTruthy();
  });

  it('shows the raw file when nothing parses as a cue', async () => {
    await render(<SubtitleFileView text="no cues here" fileName="a.srt" />);
    expect(screen.getByText('no cues here')).toBeTruthy();
  });
});

describe('NotebookFileView', () => {
  const notebook = (cells: unknown[]) =>
    JSON.stringify({ cells, metadata: { language_info: { name: 'python' } }, nbformat: 4 });

  it('renders markdown cells, code cells and their outputs', async () => {
    await render(
      <NotebookFileView
        fileName="lab.ipynb"
        text={notebook([
          { cell_type: 'markdown', source: 'Lab notes' },
          {
            cell_type: 'code',
            source: 'print(1)',
            execution_count: 1,
            outputs: [{ output_type: 'stream', text: 'done\n' }],
          },
        ])}
      />,
    );

    expect(screen.getByText('Lab notes')).toBeTruthy();
    expect(screen.getByText('In [1]')).toBeTruthy();
    expect(screen.getByText('done')).toBeTruthy();
  });

  it('marks an unexecuted cell', async () => {
    await render(
      <NotebookFileView fileName="lab.ipynb" text={notebook([{ cell_type: 'code', source: 'x = 1', outputs: [] }])} />,
    );

    expect(screen.getByText('In [ ]')).toBeTruthy();
  });

  it('falls back to the source view when the json is not a notebook', async () => {
    await render(<NotebookFileView text={'{"a":1}'} fileName="x.ipynb" />);
    expect(screen.queryByText(/^In \[/)).toBeNull();
  });
});
