// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory, so existing imports keep working.
// (rn call sites now use the web-canonical `getExamPlans` name.)
import { createPlannerService } from '@core/services/plannerService';
import { http } from '@/services/http';

export * from '@core/services/plannerService';

export const plannerService = createPlannerService(http);
