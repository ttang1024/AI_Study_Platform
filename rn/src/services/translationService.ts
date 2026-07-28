// Moved to the shared package (packages/core) — web's TranslateButton posted the
// same request inline. This shim keeps the existing import path working.
import { createLanguageService } from '@core/services/languageService';
import { http } from '@/services/http';

const core = createLanguageService(http);

export const translationService = {
  translate: core.translate,
};

export default translationService;
