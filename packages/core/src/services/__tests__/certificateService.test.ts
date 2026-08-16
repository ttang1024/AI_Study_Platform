import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCertificateService, certificateShareUrl } from '../certificateService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('createCertificateService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createCertificateService(fakeHttp)

  it('getMine GETs /api/certificates', () => {
    service.getMine()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/certificates')
  })

  it('getEligibility GETs /api/certificates/eligibility', () => {
    service.getEligibility()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/certificates/eligibility')
  })

  it('issue posts to the course-scoped endpoint', () => {
    service.issue('course-1')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/certificates/courses/course-1')
  })

  it('revoke deletes by certificate id', () => {
    service.revoke('cert-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/certificates/cert-1')
  })

  it('verify GETs the public token endpoint', () => {
    service.verify('tok-123')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/verify/tok-123')
  })
})

describe('certificateShareUrl', () => {
  it('joins origin and token with /verify/', () => {
    expect(certificateShareUrl('https://app.example.com', 'tok-123')).toBe('https://app.example.com/verify/tok-123')
  })

  it('strips a trailing slash from the origin', () => {
    expect(certificateShareUrl('https://app.example.com/', 'tok-123')).toBe('https://app.example.com/verify/tok-123')
  })
})
