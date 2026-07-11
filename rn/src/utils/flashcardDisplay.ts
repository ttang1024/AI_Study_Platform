import type { Flashcard } from '@/types';
import { clozeAnswerText, clozeQuestionText, hasClozeMarkers } from '@/utils/cloze';

// Chart cards store a JSON chart spec in `back` (see CardChart.tsx on web) — RN doesn't
// render charts yet, so show a plain-language placeholder instead of the raw JSON blob.
const CHART_PLACEHOLDER = 'Chart not supported on mobile yet — view this card on the web app.';

const isClozeCard = (card: Flashcard): boolean => card.cardType === 'cloze' || hasClozeMarkers(card.front);

export const cardFrontText = (card: Flashcard): string =>
  isClozeCard(card) ? clozeQuestionText(card.front) : card.front;

export const cardBackText = (card: Flashcard): string => {
  if (isClozeCard(card)) return clozeAnswerText(card.front);
  if (card.cardType === 'chart') return CHART_PLACEHOLDER;
  return card.back;
};
