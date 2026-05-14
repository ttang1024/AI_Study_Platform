import { describe, expect, it } from 'vitest';
import { getCorrectQuizOptionText, isQuizOptionCorrect, shuffle } from '../quizAnswers';

describe('isQuizOptionCorrect', () => {
	it('matches a selected option against a bare answer letter', () => {
		expect(isQuizOptionCorrect('B) Standard deviation', 'B')).toBe(true);
		expect(isQuizOptionCorrect('C. Variance', 'C')).toBe(true);
		expect(isQuizOptionCorrect('D: Range', 'D')).toBe(true);
	});

	it('matches equivalent full option text with different prefixes', () => {
		expect(isQuizOptionCorrect('A) Sample variance', 'A. Sample variance')).toBe(true);
		expect(isQuizOptionCorrect('Sample variance', 'A) Sample variance')).toBe(true);
	});

	it('matches equivalent answer text with punctuation or conjunction differences', () => {
		expect(isQuizOptionCorrect('40 inputs, 10 outputs', '40 inputs and 10 outputs')).toBe(true);
		expect(isQuizOptionCorrect('B) 40 inputs, 10 outputs', '40 inputs and 10 outputs')).toBe(true);
	});

	it('does not match different option letters or bodies', () => {
		expect(isQuizOptionCorrect('A) Sample variance', 'B')).toBe(false);
		expect(isQuizOptionCorrect('A) Population variance', 'A) Sample variance')).toBe(false);
	});
});

describe('getCorrectQuizOptionText', () => {
	it('returns the displayed option that matches a stored answer letter', () => {
		expect(getCorrectQuizOptionText(['A) Mean', 'B) Median', 'C) Mode'], 'B')).toBe('B) Median');
	});

	it('returns the answer verbatim when no option matches', () => {
		expect(getCorrectQuizOptionText(['A) One', 'B) Two'], 'Z')).toBe('Z');
	});

	it('returns the answer when options array is undefined', () => {
		expect(getCorrectQuizOptionText(undefined, 'A')).toBe('A');
	});
});

describe('shuffle', () => {
	it('returns an array of the same length', () => {
		const input = [1, 2, 3, 4, 5];
		expect(shuffle(input)).toHaveLength(5);
	});

	it('contains the same elements as the input', () => {
		const input = ['a', 'b', 'c', 'd'];
		expect(shuffle(input).sort()).toEqual([...input].sort());
	});

	it('does not mutate the original array', () => {
		const input = [1, 2, 3];
		const copy = [...input];
		shuffle(input);
		expect(input).toEqual(copy);
	});

	it('handles an empty array', () => {
		expect(shuffle([])).toEqual([]);
	});

	it('handles a single-element array', () => {
		expect(shuffle([42])).toEqual([42]);
	});
});
