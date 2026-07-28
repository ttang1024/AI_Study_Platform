// Service logic moved to the shared package (packages/core) — web/ had the same
// three /api/concept-links reads under the name knowledgeGraphService. This shim
// wires the RN HTTP adapter into the shared factory and re-exports the types, so
// existing imports keep working. `ConceptNode`/`ConceptEdge` are rn's historical
// names for the graph node/edge types.
import { createConceptLinksService } from '@core/services/conceptLinksService';
import { http } from '@/services/http';

export * from '@core/services/conceptLinksService';
export type {
  KnowledgeGraphNode as ConceptNode,
  KnowledgeGraphEdge as ConceptEdge,
} from '@core/services/conceptLinksService';

export const conceptLinksService = createConceptLinksService(http);
