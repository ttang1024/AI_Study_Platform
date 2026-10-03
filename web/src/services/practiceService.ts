// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/practiceService` imports across web/ keep working unchanged.
import { createPracticeService } from '@core/services/practiceService';
import { http } from './http';

export * from '@core/services/practiceService';

export const practiceService = createPracticeService(http);
