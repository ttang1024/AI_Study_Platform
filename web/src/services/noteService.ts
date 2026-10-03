// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
import { createNoteService } from '@core/services/noteService';
import { http } from './http';

export * from '@core/services/noteService';

export const noteService = createNoteService(http);
