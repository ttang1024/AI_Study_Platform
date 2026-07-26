// Service logic lives in the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types.
import { createEssayService } from '@core/services/essayService';
import { http } from '@/services/http';

export * from '@core/services/essayService';

export const essayService = createEssayService(http);
export default essayService;
