// Service logic lives in the shared package (packages/core); this wires the web HTTP adapter
// into the shared factory so web and rn stay on one implementation.
import { createLibraryTagsService } from '@core/services/libraryTagsService';
import { http } from './http';

export * from '@core/services/libraryTagsService';

export const libraryTagsService = createLibraryTagsService(http);
