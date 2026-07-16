import {
  getCorrectQuizOptionText,
  isQuizOptionCorrect,
  shuffle,
  stripQuizOptionPrefix,
} from '@/utils/quizAnswers';

// Grading happens on the client, and the backend's `correctAnswer` may be a bare letter, a
// prefixed option, or the full option text depending on how the AI generated it. Every case
// below is a shape the model has actually produced; getting any of them wrong silently marks a
// right answer wrong, which is the worst failure this app has.
describe('isQuizOptionCorrect', () => {
  it('matches an option against its own exact text', () => {
    expect(isQuizOptionCorrect('Mitochondrion', 'Mitochondrion')).toBe(true);
  });

  it('matches when the answer is a bare option letter', () => {
    expect(isQuizOptionCorrect('B) Mitochondrion', 'B')).toBe(true);
    expect(isQuizOptionCorrect('A) Ribosome', 'B')).toBe(false);
  });

  it('matches a bare letter case-insensitively', () => {
    expect(isQuizOptionCorrect('C. Golgi', 'c')).toBe(true);
  });

  it('matches when only one side carries the option prefix', () => {
    expect(isQuizOptionCorrect('B) Mitochondrion', 'Mitochondrion')).toBe(true);
    expect(isQuizOptionCorrect('Mitochondrion', 'B) Mitochondrion')).toBe(true);
  });

  it('tolerates the various prefix punctuations the model emits', () => {
    expect(isQuizOptionCorrect('A) Photosynthesis', 'Photosynthesis')).toBe(true);
    expect(isQuizOptionCorrect('A. Photosynthesis', 'Photosynthesis')).toBe(true);
    expect(isQuizOptionCorrect('A: Photosynthesis', 'Photosynthesis')).toBe(true);
    expect(isQuizOptionCorrect('A Photosynthesis', 'Photosynthesis')).toBe(true);
  });

  it('ignores case and collapses runs of whitespace', () => {
    expect(isQuizOptionCorrect('  the   Krebs CYCLE ', 'the krebs cycle')).toBe(true);
  });

  it('treats "&" and "and" as the same word', () => {
    expect(isQuizOptionCorrect('Light & dark reactions', 'Light and dark reactions')).toBe(true);
  });

  it('ignores punctuation differences', () => {
    expect(isQuizOptionCorrect('ATP-synthase, inner membrane', 'ATP synthase inner membrane')).toBe(true);
  });

  it('does not match genuinely different options', () => {
    expect(isQuizOptionCorrect('Mitochondrion', 'Ribosome')).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(isQuizOptionCorrect(undefined, 'A')).toBe(false);
    expect(isQuizOptionCorrect('A) Thing', null)).toBe(false);
    expect(isQuizOptionCorrect('', '')).toBe(false);
  });

  // A bare letter must not be read as a letter-match against an unprefixed option, or every
  // option would "match" an answer of "A".
  it('does not match a bare letter against an option with no letter prefix', () => {
    expect(isQuizOptionCorrect('Bananas', 'B')).toBe(false);
  });
});

describe('getCorrectQuizOptionText', () => {
  const options = ['A) Ribosome', 'B) Mitochondrion', 'C) Nucleus'];

  it('resolves a bare letter answer to the full option text', () => {
    expect(getCorrectQuizOptionText(options, 'B')).toBe('B) Mitochondrion');
  });

  it('falls back to the raw answer when no option matches', () => {
    expect(getCorrectQuizOptionText(options, 'Golgi apparatus')).toBe('Golgi apparatus');
  });

  it('falls back to the raw answer when there are no options at all', () => {
    expect(getCorrectQuizOptionText(undefined, 'Free text')).toBe('Free text');
  });
});

describe('stripQuizOptionPrefix', () => {
  it('removes the letter prefix so a UI drawing its own badge does not show it twice', () => {
    expect(stripQuizOptionPrefix('A) Photosynthesis')).toBe('Photosynthesis');
    expect(stripQuizOptionPrefix('b. Respiration')).toBe('Respiration');
  });

  it('leaves an unprefixed option alone', () => {
    expect(stripQuizOptionPrefix('Photosynthesis')).toBe('Photosynthesis');
  });
});

describe('shuffle', () => {
  it('preserves every element and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);

    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]); // original untouched
  });
});
