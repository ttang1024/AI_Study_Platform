// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/handwritingService` imports across rn/ keep working unchanged.
import { createHandwritingService } from '@core/services/handwritingService';
import { http } from '@/services/http';

export * from '@core/services/handwritingService';

export const handwritingService = createHandwritingService(http);
