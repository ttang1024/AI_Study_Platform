import type { HttpClient } from '../http';

export type StepVerdict = 'correct' | 'incorrect' | 'consequent' | 'unclear';

export interface GradedStep {
  step: number;
  text: string;
  verdict: StepVerdict;
  comment: string;
}

export interface HandwritingGrade {
  problem: string;
  transcription: string;
  isCorrect: boolean;
  /** 1-based index of the first genuine mistake. Null when the work is sound throughout. */
  firstErrorStep: number | null;
  steps: GradedStep[];
  /** What that step should have been. Null when there is no mistake. */
  correctedStep: string | null;
  summary: string;
  concepts: string[];
}

export interface GradePage {
  data: string;
  mimeType: string;
  fileName?: string;
}

export function createHandwritingService(http: HttpClient) {
  return {
    /**
     * Grades photos of handwritten working. Several pages are graded together as one continuous
     * solution, so a derivation that runs over a page break is still read as a single argument.
     */
    async grade(pages: GradePage[], problem?: string): Promise<HandwritingGrade> {
      const response = await http.post<{ data: HandwritingGrade }>('/api/handwriting/grade', {
        pages,
        problem: problem?.trim() || null,
      });
      return response.data.data;
    },
  };
}

export type HandwritingService = ReturnType<typeof createHandwritingService>;
