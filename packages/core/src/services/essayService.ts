import type { HttpClient } from '../http';

export interface RubricCriterion {
  name: string;
  description?: string;
  maxPoints: number;
}

export interface Rubric {
  rubricId: string;
  name: string;
  description?: string;
  criteria: RubricCriterion[];
  totalPoints: number;
  updatedAt: string;
}

export interface EssayCriterionFeedback {
  name: string;
  score: number;
  maxPoints: number;
  comment?: string;
  toImprove?: string;
}

/** Every point is quoted from the draft — the prompt refuses ungrounded comments. */
export interface EssayFeedback {
  overallComment?: string;
  strengths?: { point: string; quote?: string }[];
  improvements?: { point: string; quote?: string; suggestion?: string }[];
  criteria?: EssayCriterionFeedback[];
}

export interface EssaySubmission {
  essaySubmissionId: string;
  rubricId?: string;
  rubricName?: string;
  title: string;
  promptText?: string;
  text: string;
  wordCount: number;
  version: number;
  parentSubmissionId?: string;
  feedback?: EssayFeedback;
  /** Recomputed server-side from the criterion breakdown, not taken from the model's own total. */
  scorePercent?: number;
  gradedAt?: string;
  createdAt: string;
}

export function createEssayService(http: HttpClient) {
  return {
    getRubrics: () => http.get<{ data: Rubric[] }>('/api/essays/rubrics'),

    saveRubric: (rubric: {
      rubricId?: string;
      name: string;
      description?: string;
      criteria: RubricCriterion[];
    }) => http.post<{ data: Rubric }>('/api/essays/rubrics', rubric),

    deleteRubric: (rubricId: string) => http.delete(`/api/essays/rubrics/${rubricId}`),

    getEssays: () => http.get<{ data: EssaySubmission[] }>('/api/essays'),

    /** Every draft in one revision chain, oldest first. */
    getRevisions: (submissionId: string) =>
      http.get<{ data: EssaySubmission[] }>(`/api/essays/${submissionId}/revisions`),

    /** Pass parentSubmissionId to record this as a revision rather than a new essay. */
    saveEssay: (essay: {
      rubricId?: string;
      parentSubmissionId?: string;
      title: string;
      promptText?: string;
      text: string;
    }) => http.post<{ data: EssaySubmission }>('/api/essays', essay),

    grade: (submissionId: string) =>
      http.post<{ data: EssaySubmission }>(`/api/essays/${submissionId}/grade`),
  };
}
