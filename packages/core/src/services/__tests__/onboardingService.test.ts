import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOnboardingService } from '../onboardingService'
import { createFakeHttp } from './fakeHttp'

const fakeHttp = createFakeHttp()

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
