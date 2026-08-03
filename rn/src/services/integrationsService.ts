// Service logic lives in the shared package (packages/core); this wires the RN HTTP adapter
// into the shared factory, so web and rn stay on one implementation.
import { createIntegrationsService } from '@core/services/integrationsService';
import { http } from '@/services/http';

export * from '@core/services/integrationsService';

export const integrationsService = createIntegrationsService(http);
