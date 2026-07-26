// Service logic lives in the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
import { createEssayService } from '@core/services/essayService';
import { http } from './http';

export * from '@core/services/essayService';

const essayService = createEssayService(http);

export default essayService;
