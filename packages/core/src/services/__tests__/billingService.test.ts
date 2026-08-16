import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBillingService } from '../billingService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('billingService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createBillingService(fakeHttp)

  it('getPlans GETs /api/billing/plans', () => {
    service.getPlans()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/billing/plans')
  })

  it('getMyPlan GETs /api/billing/me', () => {
    service.getMyPlan()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/billing/me')
  })

  it('startCheckout posts the plan key and URLs', () => {
    service.startCheckout('pro', 'https://app/success', 'https://app/cancel')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/billing/checkout', {
      planKey: 'pro',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    })
  })

  it('openPortal URL-encodes the return URL as a query param', () => {
    service.openPortal('https://app/return?x=1')
    expect(fakeHttp.post).toHaveBeenCalledWith(
      `/api/billing/portal?returnUrl=${encodeURIComponent('https://app/return?x=1')}`,
    )
  })
})
