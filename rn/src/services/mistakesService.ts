// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types. Method names
// were canonicalized on web's (list→getMistakes, remove→deleteMistake,
// getVariants→generateVariants); RN call sites were renamed to match.
import { createMistakesService } from '@core/services/mistakesService';
import { http } from '@/services/http';

export * from '@core/services/mistakesService';

export const mistakesService = createMistakesService(http);
