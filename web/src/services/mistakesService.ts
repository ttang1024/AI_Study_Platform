// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/mistakesService` imports across web/ keep working unchanged.
import { createMistakesService } from '@core/services/mistakesService';
import { http } from './http';

export * from '@core/services/mistakesService';

export const mistakesService = createMistakesService(http);
