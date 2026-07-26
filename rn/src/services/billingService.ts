// Service logic lives in the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types.
import { createBillingService } from '@core/services/billingService';
import { http } from '@/services/http';

export * from '@core/services/billingService';

export const billingService = createBillingService(http);
export default billingService;
