import { describe, it, expect } from 'vitest';
import { parseNotebook, notebookCodeFileName } from '../notebook';

const notebook = (cells: unknown[], language = 'python') =>
  JSON.stringify({ cells, metadata: { language_info: { name: language } }, nbformat: 4 });

describe('parseNotebook', () => {
  it('reads markdown and code cells, joining array sources', () => {
    const parsed = parseNotebook(notebook([
      { cell_type: 'markdown', source: ['# Title\n', 'Body text'] },
      { cell_type: 'code', source: 'print(1)', execution_count: 3, outputs: [] },
    ]));

    expect(parsed?.cells).toHaveLength(2);
    expect(parsed?.cells[0]).toMatchObject({ kind: 'markdown', source: '# Title\nBody text' });
    expect(parsed?.cells[1]).toMatchObject({ kind: 'code', source: 'print(1)', executionCount: 3 });
  });

  it('reads stream output', () => {
    const parsed = parseNotebook(notebook([
      { cell_type: 'code', source: '', outputs: [{ output_type: 'stream', text: ['hello\n', 'world'] }] },
    ]));

    expect(parsed?.cells[0].outputs).toEqual([{ kind: 'text', value: 'hello\nworld' }]);
  });

  it('turns an image output into a data URI', () => {
    const parsed = parseNotebook(notebook([
      { cell_type: 'code', source: '', outputs: [{ output_type: 'display_data', data: { 'image/png': 'AAAB' } }] },
    ]));

    expect(parsed?.cells[0].outputs[0]).toEqual({ kind: 'image', value: 'data:image/png;base64,AAAB' });
  });

  it('keeps svg output as markup, not a data URI', () => {
    const parsed = parseNotebook(notebook([
      {
        cell_type: 'code',
        source: '',
        outputs: [{ output_type: 'display_data', data: { 'image/svg+xml': ['<svg>', '<rect/>', '</svg>'] } }],
      },
    ]));

    // The two platforms wrap it differently — web inlines it, rn hands it to
    // react-native-svg — so the parser must not commit to either.
    expect(parsed?.cells[0].outputs[0]).toEqual({ kind: 'svg', value: '<svg><rect/></svg>' });
  });

  it('prefers an image over the text/plain fallback of the same output', () => {
    const parsed = parseNotebook(notebook([
      {
        cell_type: 'code',
        source: '',
        outputs: [{ output_type: 'execute_result', data: { 'text/plain': '<Figure>', 'image/png': 'AAAB' } }],
      },
    ]));

    expect(parsed?.cells[0].outputs[0].kind).toBe('image');
  });

  it('strips ANSI codes from tracebacks', () => {
    const parsed = parseNotebook(notebook([
      {
        cell_type: 'code',
        source: '',
        outputs: [{ output_type: 'error', ename: 'ValueError', evalue: 'bad', traceback: ['[0;31mValueError[0m: bad'] }],
      },
    ]));

    expect(parsed?.cells[0].outputs[0]).toEqual({ kind: 'error', value: 'ValueError: bad' });
  });

  it('falls back to ename/evalue when there is no traceback', () => {
    const parsed = parseNotebook(notebook([
      { cell_type: 'code', source: '', outputs: [{ output_type: 'error', ename: 'KeyError', evalue: 'x' }] },
    ]));

    expect(parsed?.cells[0].outputs[0].value).toBe('KeyError: x');
  });

  it('returns null for JSON that is not a notebook', () => {
    expect(parseNotebook('{"foo":1}')).toBeNull();
  });

  it('returns null for content that is not JSON', () => {
    expect(parseNotebook('not json')).toBeNull();
  });
});

describe('notebookCodeFileName', () => {
  it('picks the grammar from kernel metadata', () => {
    expect(notebookCodeFileName({ cells: [], language: 'julia' })).toBe('cell.jl');
  });

  it('defaults to python', () => {
    expect(notebookCodeFileName({ cells: [] })).toBe('cell.py');
  });
});
