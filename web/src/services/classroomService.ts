// Service logic lives in the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
import { createClassroomService } from '@core/services/classroomService';
import { http } from './http';

export * from '@core/services/classroomService';

const classroomService = createClassroomService(http);

export default classroomService;
