// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
import { createQuestionBankService } from '@core/services/questionBankService';
import { http } from './http';

export * from '@core/services/questionBankService';

export const questionBankService = createQuestionBankService(http);
