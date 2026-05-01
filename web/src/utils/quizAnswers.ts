const OPTION_PREFIX = /^[A-D][).:\s]+/i;

const normalizeAnswerText = (value: string): string =>
	value
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase();

const normalizeMeaning = (value: string): string =>
	stripOptionPrefix(value)
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/\b(and)\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');

const getOptionLetter = (value: string): string | null => {
	const match = value.trim().match(/^([A-D])(?:[).:\s]|$)/i);
	return match?.[1]?.toUpperCase() ?? null;
};

const isBareOptionLetter = (value: string): boolean =>
	/^[A-D]$/i.test(value.trim());

const stripOptionPrefix = (value: string): string =>
	value.trim().replace(OPTION_PREFIX, '').trim();

export const isQuizOptionCorrect = (option: string | undefined | null, answer: string | undefined | null): boolean => {
	if (!option || !answer) return false;

	const normalizedOption = normalizeAnswerText(option);
	const normalizedAnswer = normalizeAnswerText(answer);
	if (normalizedOption === normalizedAnswer) return true;

	const optionLetter = getOptionLetter(option);
	const answerLetter = getOptionLetter(answer);
	if (optionLetter && isBareOptionLetter(answer) && optionLetter === answerLetter) return true;

	const optionBody = normalizeAnswerText(stripOptionPrefix(option));
	const answerBody = normalizeAnswerText(stripOptionPrefix(answer));
	if (optionBody.length > 0 && optionBody === answerBody) return true;

	const optionMeaning = normalizeMeaning(option);
	const answerMeaning = normalizeMeaning(answer);
	return optionMeaning.length > 0 && optionMeaning === answerMeaning;
};

export const getCorrectQuizOptionText = (options: string[] | undefined, answer: string): string =>
	options?.find(option => isQuizOptionCorrect(option, answer)) ?? answer;
