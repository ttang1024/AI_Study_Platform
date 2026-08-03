// Service logic lives in the shared package (packages/core); this wires the web HTTP adapter
// into the shared factory so web and rn stay on one implementation.
import { createCertificateService } from '@core/services/certificateService';
import { http } from './http';

export * from '@core/services/certificateService';

export const certificateService = createCertificateService(http);
