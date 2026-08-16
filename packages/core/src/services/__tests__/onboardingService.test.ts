import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOnboardingService } from '../onboardingService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('onboardingService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createOnboardingService(fakeHttp)

  it('getState GETs /api/onboarding', () => {
    service.getState()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/onboarding')
  })

  it('dismiss POSTs /api/onboarding/dismiss', () => {
    service.dismiss()
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/onboarding/dismiss')
  })

  it('seedDemo POSTs /api/onboarding/demo', () => {
    service.seedDemo()
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/onboarding/demo')
  })
})
