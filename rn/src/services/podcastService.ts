// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/podcastService` imports across rn/ keep working unchanged.
import { createPodcastService } from '@core/services/podcastService';
import { http } from '@/services/http';

export * from '@core/services/podcastService';

export const podcastService = createPodcastService(http);
