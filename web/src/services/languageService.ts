// Translation and sentence mining live in the shared package (packages/core) —
// rn/ posted the identical requests. Pronunciation scoring stays per-app (see
// usePronunciationPractice): it uploads a MediaRecorder Blob, which the shared
// HttpClient seam has no opinion about; only its result types are shared.
import { createLanguageService } from '@core/services/languageService';
import { http } from './http';

export * from '@core/services/languageService';

export const languageService = createLanguageService(http);
