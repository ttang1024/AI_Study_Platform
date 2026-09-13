/**
 * Chart flashcards store a chart-spec JSON (`{ labels, datasets }`) as their answer. Callers that
 * can't render it (practice report, mobile) substitute a placeholder instead of printing the blob.
 */
export const isChartAnswer = (answer: string): boolean => {
  if (!answer.trimStart().startsWith('{')) return false;
  try {
    const parsed = JSON.parse(answer);
    return !!(parsed?.labels && parsed?.datasets);
  } catch {
    return false;
  }
};
