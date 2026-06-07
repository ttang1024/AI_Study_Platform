import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../apiClient', () => ({ apiClient: mockApiClient }))

// Import after mocking so the module picks up the mock
const { authService } = await import('../authService')

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns mapped user and access token on success', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          data: {
            accessToken: 'access-token',
            expiresAt: '2026-01-01T00:00:00Z',
            userId: 'user-123',
            email: 'user@example.com',
            fullName: 'Jane Doe',
          },
        },
      })

      const result = await authService.login('user@example.com', 'password')

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'user@example.com',
        password: 'password',
      })
      expect(result.accessToken).toBe('access-token')
      expect(result.user).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        name: 'Jane Doe',
      })
    })

    it('propagates errors thrown by apiClient', async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error('Network error'))
      await expect(authService.login('a@b.com', 'pass')).rejects.toThrow('Network error')
    })
  })

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('calls the correct endpoint with all fields', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: {} })
      const payload = {
        email: 'new@example.com',
        fullName: 'New User',
        password: 'Password1',
        otpCode: '123456',
      }
      await authService.register(payload)
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/register', payload)
    })
  })

  // ─── refreshToken ──────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('returns a new access token (refresh token comes from the HttpOnly cookie)', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          data: {
            accessToken: 'new-access',
          },
        },
      })
      const result = await authService.refreshToken()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/refresh-token', {})
      expect(result.accessToken).toBe('new-access')
    })
  })

  // ─── sendOtp ───────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('posts email and purpose', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: {} })
      await authService.sendOtp('user@example.com', 'registration')
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/send-otp', {
        email: 'user@example.com',
        purpose: 'registration',
      })
    })
  })

  // ─── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('posts reset payload', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: {} })
      const payload = { email: 'u@x.com', otpCode: '654321', newPassword: 'NewPass1' }
      await authService.resetPassword(payload)
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/reset-password', payload)
    })
  })

  // ─── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('posts to the logout endpoint (refresh token comes from the HttpOnly cookie)', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: {} })
      await authService.logout()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/logout', {})
    })
  })

  // ─── changePassword ────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('posts current and new password', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: {} })
      await authService.changePassword({ currentPassword: 'old', newPassword: 'NewPass1' })
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/change-password', {
        currentPassword: 'old',
        newPassword: 'NewPass1',
      })
    })
  })

  // ─── updateProfile ─────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('sends a PUT with fullName', async () => {
      mockApiClient.put.mockResolvedValueOnce({ data: {} })
      await authService.updateProfile({ fullName: 'Updated Name' })
      expect(mockApiClient.put).toHaveBeenCalledWith('/api/auth/update-profile', {
        fullName: 'Updated Name',
      })
    })
  })
})
