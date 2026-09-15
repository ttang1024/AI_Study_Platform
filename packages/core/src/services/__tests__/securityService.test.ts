import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSecurityService, ACCOUNT_DELETION_CONFIRMATION } from '../securityService'
import { createFakeHttp } from './fakeHttp'

const fakeHttp = createFakeHttp()

describe('securityService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createSecurityService(fakeHttp)

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
