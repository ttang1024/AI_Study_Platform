// Service logic lives in the shared package (packages/core); this wires the RN HTTP adapter
// into the shared factory, so web and rn stay on one implementation.
import { createPeerReviewService } from '@core/services/peerReviewService';
import { http } from '@/services/http';

export * from '@core/services/peerReviewService';

export const peerReviewService = createPeerReviewService(http);
