import { render, screen, waitFor } from '@testing-library/react-native';

import { DocumentFileView } from '@/components/library/viewers/DocumentFileView';

const mockFetch = (body: string, ok = true) => {
  const fetchMock = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, text: async () => body });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DocumentFileView', () => {
  it('fetches the file once and routes a source file to the code view', async () => {
    const fetchMock = mockFetch('def f():\n    return x');

    await render(<DocumentFileView url="https://blob/a.py" fileName="a.py" kind="code" />);

    await waitFor(() => expect(screen.getByText('return')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://blob/a.py');
  });

  it('routes csv to the table view', async () => {
    mockFetch('student,score\nAda,99');

    await render(<DocumentFileView url="https://blob/g.csv" fileName="grades.csv" kind="table" />);

    await waitFor(() => expect(screen.getByText('student')).toBeTruthy());
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('routes captions to the cue list', async () => {
    mockFetch('1\n00:00:01,000 --> 00:00:04,000\nHello world\n');

    await render(<DocumentFileView url="https://blob/a.srt" fileName="a.srt" kind="subtitle" />);

    await waitFor(() => expect(screen.getByText('Hello world')).toBeTruthy());
    expect(screen.getByText('0:01')).toBeTruthy();
  });

  it('pretty-prints minified json before showing it', async () => {
    mockFetch('{"a":1,"b":2}');

    await render(<DocumentFileView url="https://blob/a.json" fileName="config.json" kind="data" />);

    // Re-indented, so the object is no longer one line.
    await waitFor(() => expect(screen.getByText('JSON · 1 lines')).toBeTruthy());
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders a notebook from the raw file', async () => {
    mockFetch(JSON.stringify({
      cells: [{ cell_type: 'code', source: 'print(1)', execution_count: 2, outputs: [] }],
      metadata: { language_info: { name: 'python' } },
    }));

    await render(<DocumentFileView url="https://blob/a.ipynb" fileName="lab.ipynb" kind="notebook" />);

    await waitFor(() => expect(screen.getByText('In [2]')).toBeTruthy());
  });

  it('reports a failed download instead of rendering an empty file', async () => {
    mockFetch('', false);

    await render(<DocumentFileView url="https://blob/a.py" fileName="a.py" kind="code" />);

    await waitFor(() => expect(screen.getByText(/Couldn't load this file/)).toBeTruthy());
  });

  it('falls back to plain text for a kind with no dedicated renderer', async () => {
    mockFetch('extracted body text');

    await render(<DocumentFileView url="https://blob/a.epub" fileName="book.epub" kind="text" />);

    await waitFor(() => expect(screen.getByText('extracted body text')).toBeTruthy());
  });
});
