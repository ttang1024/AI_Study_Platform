// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/practiceService` imports across rn/ keep working unchanged.
import { createPracticeService } from '@core/services/practiceService';
import { http } from '@/services/http';

export * from '@core/services/practiceService';

export const practiceService = createPracticeService(http);
