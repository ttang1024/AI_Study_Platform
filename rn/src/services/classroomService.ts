// Service logic lives in the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types.
import { createClassroomService } from '@core/services/classroomService';
import { http } from '@/services/http';

export * from '@core/services/classroomService';

export const classroomService = createClassroomService(http);
export default classroomService;
