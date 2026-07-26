// Service logic lives in the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
import { createBillingService } from '@core/services/billingService';
import { http } from './http';

export * from '@core/services/billingService';

const billingService = createBillingService(http);

export default billingService;
