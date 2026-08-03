// Service logic lives in the shared package (packages/core); this wires the web HTTP adapter
// into the shared factory so web and rn stay on one implementation.
import { createTodayService } from '@core/services/todayService';
import { http } from './http';

export * from '@core/services/todayService';

export const todayService = createTodayService(http);
