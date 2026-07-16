// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing `@/services/courseService`
// imports across web/ keep working unchanged.
import { createCourseService } from '@core/services/courseService';
import { http } from './http';

export * from '@core/services/courseService';

export const courseService = createCourseService(http);
