// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/handwritingService` imports across web/ keep working unchanged.
import { createHandwritingService } from '@core/services/handwritingService';
import { http } from './http';

export * from '@core/services/handwritingService';

export const handwritingService = createHandwritingService(http);
