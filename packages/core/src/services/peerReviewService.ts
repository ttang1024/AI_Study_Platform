import type { HttpClient } from '../http';
import type { RubricCriterion } from './essayService';

export interface PeerReviewScore {
  criterionName: string;
  points: number;
  comment: string | null;
}

/**
 * A review as its author sees it. There is no reviewer field: peer review is single-blind, and the
 * omission is structural rather than something each caller has to remember.
 */
export interface PeerReview {
  essayPeerReviewId: string;
  status: 'assigned' | 'submitted' | 'cancelled';
  scores: PeerReviewScore[];
  overallComment: string | null;
  scorePercent: number | null;
  assignedAt: string;
  submittedAt: string | null;
}

/** An entry in the reviewer's queue — enough to list, not enough to read. */
export interface PeerReviewAssignment {
  essayPeerReviewId: string;
  essaySubmissionId: string;
  essayTitle: string;
  promptText: string | null;
  wordCount: number;
  status: 'assigned' | 'submitted' | 'cancelled';
  assignedAt: string;
  submittedAt: string | null;
}

/** The full draft and its rubric. Returned only to an assigned reviewer. */
export interface PeerReviewWorkspace {
  essayPeerReviewId: string;
  essaySubmissionId: string;
  essayTitle: string;
  promptText: string | null;
  essayText: string;
  wordCount: number;
  criteria: RubricCriterion[];
  status: 'assigned' | 'submitted' | 'cancelled';
  existingScores: PeerReviewScore[];
  existingComment: string | null;
}

export function createPeerReviewService(http: HttpClient) {
  return {
    /** Asks classmates in a classroom to review one of your drafts. */
    request: (essayId: string, classroomId: string, reviewerCount: number) =>
      http.post<{ data: number; message: string }>(`/api/essays/${essayId}/peer-review`, {
        classroomId,
        reviewerCount,
      }),

    /** Reviews on your own draft, including pending ones so progress is visible. */
    getForEssay: (essayId: string) =>
      http.get<{ data: PeerReview[] }>(`/api/essays/${essayId}/peer-review`),

    getMyQueue: (includeSubmitted = false) =>
      http.get<{ data: PeerReviewAssignment[] }>('/api/peer-reviews', {
        params: { includeSubmitted },
      }),

    /** The only path by which one user reads another's essay text. */
    open: (reviewId: string) =>
      http.get<{ data: PeerReviewWorkspace }>(`/api/peer-reviews/${reviewId}`),

    submit: (reviewId: string, scores: PeerReviewScore[], overallComment: string | null) =>
      http.post<{ data: PeerReview; message: string }>(`/api/peer-reviews/${reviewId}`, {
        scores,
        overallComment,
      }),
  };
}
