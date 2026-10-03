// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter and the idb offline tier into the shared factory, so existing
// imports keep working.
import { createGlossaryService } from '@core/services/glossaryService'
import { http } from './http'
import { offlineCacheService } from './offlineCacheService'

export * from '@core/services/glossaryService'

export const glossaryService = createGlossaryService(http, offlineCacheService)
