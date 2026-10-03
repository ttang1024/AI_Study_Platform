// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/workedProblemsService` imports across web/ keep working unchanged.
import { createWorkedProblemsService } from '@core/services/workedProblemsService';
import { http } from './http';

export * from '@core/services/workedProblemsService';

export const workedProblemsService = createWorkedProblemsService(http);
