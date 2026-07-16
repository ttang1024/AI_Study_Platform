import { clozeAnswerText, clozeQuestionText, hasClozeMarkers } from '@/utils/cloze';

describe('cloze', () => {
  it('blanks every marker on the question side', () => {
    expect(clozeQuestionText('The {{mitochondrion}} makes {{ATP}}.'))
      .toBe('The _____ makes _____.');
  });

  it('reveals every marker inline on the answer side', () => {
    expect(clozeAnswerText('The {{mitochondrion}} makes {{ATP}}.'))
      .toBe('The mitochondrion makes ATP.');
  });

  it('leaves text with no markers untouched', () => {
    expect(clozeQuestionText('Plain sentence.')).toBe('Plain sentence.');
    expect(clozeAnswerText('Plain sentence.')).toBe('Plain sentence.');
  });

  it('detects markers so mistagged cards never leak raw braces into the UI', () => {
    expect(hasClozeMarkers('The {{term}} here')).toBe(true);
    expect(hasClozeMarkers('No markers here')).toBe(false);
  });

  // hasClozeMarkers builds a fresh RegExp from the source each call. If it reused a shared /g
  // regex, `lastIndex` would persist between calls and every other call would wrongly return
  // false — the classic stateful-global-regex bug.
  it('gives the same answer when called repeatedly on the same text', () => {
    const text = 'The {{term}} here';
    expect(hasClozeMarkers(text)).toBe(true);
    expect(hasClozeMarkers(text)).toBe(true);
    expect(hasClozeMarkers(text)).toBe(true);
  });
});
