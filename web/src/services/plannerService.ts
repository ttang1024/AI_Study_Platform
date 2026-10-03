// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
import { createPlannerService } from '@core/services/plannerService';
import { http } from './http';

export * from '@core/services/plannerService';

export const plannerService = createPlannerService(http);
