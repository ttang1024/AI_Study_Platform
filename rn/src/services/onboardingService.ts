// Service logic lives in the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types.
import { createOnboardingService } from '@core/services/onboardingService';
import { http } from '@/services/http';

export * from '@core/services/onboardingService';

export const onboardingService = createOnboardingService(http);
export default onboardingService;
