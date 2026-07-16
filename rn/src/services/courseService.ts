// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory, so existing `@/services/courseService`
// imports across rn/ keep working unchanged.
import { createCourseService } from '@core/services/courseService';
import { http } from '@/services/http';

export * from '@core/services/courseService';

export const courseService = createCourseService(http);
