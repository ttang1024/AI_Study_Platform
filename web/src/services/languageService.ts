// Translation lives in the shared package (packages/core) — rn/ posts the identical request.
import { createLanguageService } from '@core/services/languageService';
import { http } from './http';

export * from '@core/services/languageService';

export const languageService = createLanguageService(http);
