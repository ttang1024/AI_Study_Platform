import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthService } from '../authService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const rawAuthResponse = (overrides: Record<string, unknown> = {}) => ({
  userId: 'u-1',
  email: 'a@b.com',
  fullName: 'Ada Lovelace',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('authService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createAuthService(fakeHttp)

  describe('login', () => {
    it('posts credentials and maps the response', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: rawAuthResponse() } })

      const result = await service.login('a@b.com', 'secret')

      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/login', { email: 'a@b.com', password: 'secret' })
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2026-01-01T00:00:00Z',
        user: { id: 'u-1', email: 'a@b.com', name: 'Ada Lovelace' },
        twoFactorRequired: false,
        challengeToken: null,
      })
    })

    it('falls back to accessTokenExpiry when expiresAt is absent', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({
        data: { data: rawAuthResponse({ expiresAt: undefined, accessTokenExpiry: '2026-02-02T00:00:00Z' }) },
      })
      const result = await service.login('a@b.com', 'secret')
      expect(result.expiresAt).toBe('2026-02-02T00:00:00Z')
    })

    it('defaults refreshToken to empty string when absent (web/cookie flow)', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({
        data: { data: rawAuthResponse({ refreshToken: undefined }) },
      })
      const result = await service.login('a@b.com', 'secret')
      expect(result.refreshToken).toBe('')
    })

    it('surfaces a pending two-factor challenge without leaking blank tokens as usable', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({
        data: {
          data: rawAuthResponse({
            accessToken: '',
            refreshToken: '',
            twoFactorRequired: true,
            challengeToken: 'chal-1',
          }),
        },
      })
      const result = await service.login('a@b.com', 'secret')
      expect(result.twoFactorRequired).toBe(true)
      expect(result.challengeToken).toBe('chal-1')
    })
  })

  describe('verifyTwoFactor', () => {
    it('posts the challenge token and code', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: rawAuthResponse() } })
      await service.verifyTwoFactor('chal-1', '123456')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/2fa/verify', { challengeToken: 'chal-1', code: '123456' })
    })
  })

  describe('loginWithOAuth', () => {
    it('posts provider/code/redirectUri', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: rawAuthResponse() } })
      await service.loginWithOAuth('google', 'code-1', 'https://app/callback')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/oauth', {
        provider: 'google',
        code: 'code-1',
        redirectUri: 'https://app/callback',
      })
    })
  })

  describe('refreshToken', () => {
    it('sends an empty body when no token is passed (web cookie flow)', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { accessToken: 'new-token' } } })
      const result = await service.refreshToken()
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/refresh-token', {})
      expect(result).toEqual({ accessToken: 'new-token' })
    })

    it('sends the refresh token explicitly when provided (native flow)', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { accessToken: 'new-token' } } })
      await service.refreshToken('stored-refresh')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/refresh-token', { refreshToken: 'stored-refresh' })
    })
  })

  describe('logout', () => {
    it('sends an empty body when refreshToken is undefined', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: {} })
      await service.logout()
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/logout', {})
    })

    it('sends refreshToken: null explicitly when passed as null', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: {} })
      await service.logout(null)
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/logout', { refreshToken: null })
    })
  })

  describe('sendOtp / register / resetPassword / changePassword / updateProfile', () => {
    it('posts to the expected endpoints with the given payload', async () => {
      vi.mocked(fakeHttp.post).mockResolvedValue({ data: {} })
      vi.mocked(fakeHttp.put).mockResolvedValue({ data: {} })

      await service.sendOtp('a@b.com', 'registration')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/send-otp', { email: 'a@b.com', purpose: 'registration' })

      const registerPayload = { email: 'a@b.com', fullName: 'Ada', password: 'pw', otpCode: '111111' }
      await service.register(registerPayload)
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/register', registerPayload)

      const resetPayload = { email: 'a@b.com', otpCode: '111111', newPassword: 'newpw' }
      await service.resetPassword(resetPayload)
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/reset-password', resetPayload)

      const changePayload = { currentPassword: 'old', newPassword: 'newpw' }
      await service.changePassword(changePayload)
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/auth/change-password', changePayload)

      await service.updateProfile({ fullName: 'New Name' })
      expect(fakeHttp.put).toHaveBeenCalledWith('/api/auth/update-profile', { fullName: 'New Name' })
    })
  })
})
