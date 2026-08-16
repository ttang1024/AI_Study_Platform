import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSecurityService, ACCOUNT_DELETION_CONFIRMATION } from '../securityService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('securityService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createSecurityService(fakeHttp)

  it('getTwoFactorStatus GETs /api/security/2fa', () => {
    service.getTwoFactorStatus()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/security/2fa')
  })

  it('confirmTwoFactor posts the code', () => {
    service.confirmTwoFactor('123456')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/security/2fa/confirm', { code: '123456' })
  })

  it('disableTwoFactor posts the password', () => {
    service.disableTwoFactor('pw')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/security/2fa/disable', { password: 'pw' })
  })

  describe('getSessions', () => {
    it('omits the header when no refresh token is passed (web/cookie flow)', () => {
      service.getSessions()
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/security/sessions', { headers: undefined })
    })

    it('sends the refresh token as a header, not a query param (native flow)', () => {
      service.getSessions('rt-1')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/security/sessions', { headers: { 'X-Refresh-Token': 'rt-1' } })
    })
  })

  it('revokeSession deletes by session id', () => {
    service.revokeSession('s-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/security/sessions/s-1')
  })

  it('revokeOtherSessions posts the refresh token', () => {
    service.revokeOtherSessions('rt-1')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/security/sessions/revoke-others', { refreshToken: 'rt-1' })
  })

  it('getAuditLog defaults page/pageSize', () => {
    service.getAuditLog()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/security/audit-log', { params: { page: 1, pageSize: 25 } })
  })

  it('requestAccountDeletion posts password and confirmation phrase', () => {
    service.requestAccountDeletion('pw', ACCOUNT_DELETION_CONFIRMATION)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/security/account/delete', {
      password: 'pw',
      confirmation: ACCOUNT_DELETION_CONFIRMATION,
    })
  })

  it('cancelAccountDeletion posts to the sessionless auth endpoint', () => {
    service.cancelAccountDeletion('a@b.com', 'pw')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/cancel-deletion', { email: 'a@b.com', password: 'pw' })
  })

  it('ACCOUNT_DELETION_CONFIRMATION is the exact required phrase', () => {
    expect(ACCOUNT_DELETION_CONFIRMATION).toBe('DELETE MY ACCOUNT')
  })
})
