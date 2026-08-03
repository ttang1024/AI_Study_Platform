import { describe, it, expect } from 'vitest';
import { tokenize, tokenizeLines, HIGHLIGHT_SIZE_LIMIT } from '../syntaxHighlight';

const kindsOf = (source: string, fileName: string) =>
  tokenize(source, fileName).map(t => [t.kind, t.text] as const);

describe('tokenize', () => {
  it('never drops or reorders input', () => {
    const source = 'def f(x):\n  # note\n  return "a" + 1  # tail\n';
    expect(tokenize(source, 'a.py').map(t => t.text).join('')).toBe(source);
  });

  it('marks python comments, strings, numbers and keywords', () => {
    const tokens = kindsOf('return "hi" + 42 # why', 'a.py');

    expect(tokens).toContainEqual(['keyword', 'return']);
    expect(tokens).toContainEqual(['string', '"hi"']);
    expect(tokens).toContainEqual(['number', '42']);
    expect(tokens).toContainEqual(['comment', '# why']);
  });

  it('uses // comments for c-family files and # for shell', () => {
    expect(kindsOf('// note', 'a.ts')).toContainEqual(['comment', '// note']);
    expect(kindsOf('# note', 'a.sh')).toContainEqual(['comment', '# note']);
    // '#' is not a comment in TypeScript — private fields start with it.
    expect(kindsOf('#count', 'a.ts')).not.toContainEqual(['comment', '#count']);
  });

  it('keeps an unterminated string on its own line', () => {
    const tokens = kindsOf("it's fine\nreturn 1", 'a.py');
    const string = tokens.find(([kind]) => kind === 'string');

    expect(string?.[1]).not.toContain('\n');
    expect(tokens).toContainEqual(['keyword', 'return']);
  });

  it('honours escaped quotes inside strings', () => {
    expect(kindsOf('x = "a\\"b" ;', 'a.c')).toContainEqual(['string', '"a\\"b"']);
  });

  it('does not treat a digit inside an identifier as a number', () => {
    expect(kindsOf('var x2 = 1', 'a.js')).not.toContainEqual(['number', '2']);
  });

  it('closes an unterminated block comment at end of file', () => {
    const tokens = kindsOf('/* open', 'a.c');
    expect(tokens).toEqual([['comment', '/* open']]);
  });
});

describe('tokenizeLines', () => {
  it('splits a block comment across the lines it spans', () => {
    const lines = tokenizeLines('a\n/* one\ntwo */\nb', 'a.c');

    expect(lines).toHaveLength(4);
    expect(lines[1]).toEqual([{ text: '/* one', kind: 'comment' }]);
    expect(lines[2]).toEqual([{ text: 'two */', kind: 'comment' }]);
  });

  it('normalises CRLF so line numbers match the file', () => {
    expect(tokenizeLines('a\r\nb', 'a.txt')).toHaveLength(2);
  });

  it('keeps blank lines as empty token rows', () => {
    expect(tokenizeLines('a\n\nb', 'a.py')[1]).toEqual([]);
  });

  it('skips highlighting past the size limit', () => {
    const huge = 'x = 1\n'.repeat(Math.ceil(HIGHLIGHT_SIZE_LIMIT / 6) + 1);
    const lines = tokenizeLines(huge, 'a.py');

    expect(lines.every(line => line.every(token => token.kind === 'plain'))).toBe(true);
  });
});
