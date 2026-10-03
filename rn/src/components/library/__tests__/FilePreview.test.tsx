import { render, screen, waitFor } from '@testing-library/react-native';

import { FilePreview } from '@/components/library/FilePreview';
import type { Document } from '@/types';

const doc = (name: string, type: Document['type'] = 'txt'): Document =>
  ({ id: 'doc-1', name, type, url: '', uploadDate: '2026-08-03T00:00:00Z' }) as Document;

beforeEach(() => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => 'def f():\n    return x',
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('FilePreview', () => {
  it('renders a source file natively instead of in a WebView', async () => {
    await render(<FilePreview url="https://blob/a.py" doc={doc('analysis.py')} />);

    await waitFor(() => expect(screen.getByText('return')).toBeTruthy());
    expect(screen.queryByTestId('webview')).toBeNull();
  });

  it('keeps the WebView for a pdf', async () => {
    await render(<FilePreview url="https://blob/a.pdf" doc={doc('paper.pdf', 'pdf')} />);

    expect(screen.getByTestId('webview')).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('keeps the WebView for a binary format that has no native renderer', async () => {
    await render(<FilePreview url="https://blob/a.docx" doc={doc('essay.docx', 'docx')} />);
    expect(screen.getByTestId('webview')).toBeTruthy();
  });

  it('disables scripts when the WebView is showing uploaded html', async () => {
    await render(<FilePreview url="https://blob/a.html" doc={doc('page.html')} />);

    // Uploaded markup is someone else's code; it is read, never run.
    expect(screen.getByTestId('webview').props.javaScriptEnabled).toBe(false);
  });

  it('leaves scripts enabled for the formats the WebView renders itself', async () => {
    await render(<FilePreview url="https://blob/a.pdf" doc={doc('paper.pdf', 'pdf')} />);
    expect(screen.getByTestId('webview').props.javaScriptEnabled).toBe(true);
  });
});
