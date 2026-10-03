// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types. Method names
// were canonicalized on web's (getForDocument→getProblems, generateForDocument→
// generateProblems, getForVideo→getVideoProblems, generateForVideo→
// generateVideoProblems); RN call sites were renamed to match.
import { createWorkedProblemsService } from '@core/services/workedProblemsService';
import type { ProblemAttempt } from '@core/services/workedProblemsService';
import { http } from '@/services/http';

export * from '@core/services/workedProblemsService';

/** RN's historical name for the attempt DTO. */
export type WorkedProblemAttempt = ProblemAttempt;

export const workedProblemsService = createWorkedProblemsService(http);
