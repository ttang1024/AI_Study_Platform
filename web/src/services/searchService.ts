// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/searchService` imports across web/ keep working unchanged.
import { createSearchService } from '@core/services/searchService';
import { http } from './http';

export * from '@core/services/searchService';

export const searchService = createSearchService(http);
