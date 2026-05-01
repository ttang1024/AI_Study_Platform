import { describe, expect, it } from 'vitest';
import { getCorrectQuizOptionText, isQuizOptionCorrect } from '../quizAnswers';

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
});
