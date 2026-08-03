// Service logic lives in the shared package (packages/core); this wires the web HTTP adapter
// into the shared factory so web and rn stay on one implementation.
import { createSecurityService } from '@core/services/securityService';
import { http } from './http';

export * from '@core/services/securityService';

export const securityService = createSecurityService(http);
