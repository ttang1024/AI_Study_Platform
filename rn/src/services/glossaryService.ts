// Service logic moved to the shared package (packages/core). This shim keeps
// rn's historical method names over the shared web-canonical factory. No
// offline cache is injected, so list() errors propagate exactly as before.
import { createGlossaryService } from '@core/services/glossaryService';
import { http } from '@/services/http';
import type { GlossaryTerm } from '@/types';

const core = createGlossaryService(http);

export const glossaryService = {
  list(): Promise<GlossaryTerm[]> {
    return core.getAllGlossary();
  },

  getMasteredIds: core.getMasteredIds,

  toggleMastered: core.toggleMastered,

  update(termId: string, data: { term: string; definition: string }): Promise<GlossaryTerm> {
    return core.updateTerm(termId, data.term, data.definition);
  },

  remove: core.deleteTerm,

  generateForDocument: core.generateGlossary,

  generateForVideo: core.generateVideoGlossary,
};
