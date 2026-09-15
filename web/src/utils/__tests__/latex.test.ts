import { describe, it, expect } from 'vitest';
import { toDisplayMath, looksLikeLatex } from '../latex';

describe('toDisplayMath', () => {
  it('wraps bare LaTeX as a standalone $$ block', () => {
    expect(toDisplayMath('\\theta = 5')).toBe('$$\n\\theta = 5\n$$');
  });

  it('does not double-wrap a formula the model already delimited', () => {
    for (const already of ['$$\\theta = 5$$', '$\\theta = 5$', '\\[\\theta = 5\\]', '\\(\\theta = 5\\)']) {
      expect(toDisplayMath(already)).toBe('$$\n\\theta = 5\n$$');
    }
  });

  it('keeps inner dollars that are not delimiters', () => {
    expect(toDisplayMath('a + b')).toBe('$$\na + b\n$$');
  });
});

describe('looksLikeLatex', () => {
  it('spots LaTeX markers and passes plain text through', () => {
    expect(looksLikeLatex('\\theta = 5')).toBe(true);
    expect(looksLikeLatex('x^2')).toBe(true);
    expect(looksLikeLatex('distance = speed times time')).toBe(false);
  });
});
