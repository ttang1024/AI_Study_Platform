// Service logic lives in the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
import { createOnboardingService } from '@core/services/onboardingService';
import { http } from './http';

export * from '@core/services/onboardingService';

const onboardingService = createOnboardingService(http);

export default onboardingService;
