// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/podcastService` imports across web/ keep working unchanged.
import { createPodcastService } from '@core/services/podcastService';
import { http } from './http';

export * from '@core/services/podcastService';

export const podcastService = createPodcastService(http);
