// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory, so existing imports keep working.
// (rn call sites now use the web-canonical API: `delete`, response-wrapped returns.)
import { createAnnotationsService } from '@core/services/annotationsService';
import { http } from '@/services/http';

export * from '@core/services/annotationsService';

export const annotationsService = createAnnotationsService(http);
