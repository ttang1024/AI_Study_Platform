// Service logic moved to the shared package (packages/core) — rn/ had the same
// three /api/concept-links reads under the name conceptLinksService. This file
// wires the web HTTP adapter into the shared factory and re-exports the types,
// so existing imports keep working. Node titles are still flattened to plain
// text, now by the shared regex stripHtml rather than a DOM element.
import { createConceptLinksService } from '@core/services/conceptLinksService';
import { http } from './http';

export * from '@core/services/conceptLinksService';

export const knowledgeGraphService = createConceptLinksService(http);
