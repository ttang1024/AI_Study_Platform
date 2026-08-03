import { describe, it, expect } from 'vitest';
import { parseDelimited, isTabular, MAX_TABLE_ROWS } from '../delimitedText';

describe('parseDelimited', () => {
  it('reads a simple csv', () => {
    const table = parseDelimited('a,b\n1,2\n3,4\n', 'data.csv');

    expect(table.headers).toEqual(['a', 'b']);
    expect(table.rows).toEqual([['1', '2'], ['3', '4']]);
    expect(table.totalRows).toBe(2);
  });

  it('keeps delimiters, newlines and doubled quotes inside quoted fields', () => {
    const table = parseDelimited('name,note\n"Smith, J.","said ""hi""\nagain"\n', 'x.csv');

    expect(table.rows[0][0]).toBe('Smith, J.');
    expect(table.rows[0][1]).toBe('said "hi"\nagain');
  });

  it('uses tabs for .tsv', () => {
    const table = parseDelimited('a\tb\n1\t2', 'x.tsv');
    expect(table.headers).toEqual(['a', 'b']);
  });

  it('sniffs the delimiter when the extension does not say', () => {
    const table = parseDelimited('a;b;c\n1;2;3', 'x.txt');
    expect(table.headers).toEqual(['a', 'b', 'c']);
  });

  it('ignores a trailing newline instead of emitting a blank row', () => {
    expect(parseDelimited('a,b\n1,2\n\n', 'x.csv').rows).toEqual([['1', '2']]);
  });

  it('preserves empty cells', () => {
    expect(parseDelimited('a,b,c\n1,,3', 'x.csv').rows[0]).toEqual(['1', '', '3']);
  });

  it('truncates very long files and reports the real row count', () => {
    const text = 'a,b\n' + '1,2\n'.repeat(MAX_TABLE_ROWS + 50);
    const table = parseDelimited(text, 'x.csv');

    expect(table.rows).toHaveLength(MAX_TABLE_ROWS);
    expect(table.totalRows).toBe(MAX_TABLE_ROWS + 50);
    expect(table.truncated).toBe(true);
  });
});

describe('isTabular', () => {
  it('rejects a single-column file', () => {
    expect(isTabular(parseDelimited('just prose\nmore prose', 'x.csv'))).toBe(false);
  });

  it('rejects a header with no rows', () => {
    expect(isTabular(parseDelimited('a,b', 'x.csv'))).toBe(false);
  });

  it('accepts a real grid', () => {
    expect(isTabular(parseDelimited('a,b\n1,2', 'x.csv'))).toBe(true);
  });
});
