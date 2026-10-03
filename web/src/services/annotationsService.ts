// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
import { createAnnotationsService } from '@core/services/annotationsService';
import { http } from './http';

export * from '@core/services/annotationsService';

const annotationsService = createAnnotationsService(http);

export default annotationsService;
