// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
import { createStudyGroupService } from '@core/services/studyGroupService';
import { http } from './http';

export * from '@core/services/studyGroupService';

const studyGroupService = createStudyGroupService(http);

export default studyGroupService;
