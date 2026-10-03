import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuthService = {
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  sendOtp: vi.fn(),
  resetPassword: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  loginWithOAuth: vi.fn(),
}

vi.mock('../../services/authService', () => ({ authService: mockAuthService }))

const { AuthProvider, useAuth } = await import('../AuthContext')

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

const testUser = { id: 'u1', email: 'test@example.com', name: 'Test User' }

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('starts unauthenticated with no stored user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('restores user from localStorage on mount', async () => {
    localStorage.setItem('sp_user', JSON.stringify(testUser))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.email).toBe('test@example.com')
  })

  it('login stores access token and sets user', async () => {
    mockAuthService.login.mockResolvedValueOnce({
      accessToken: 'at',
      user: testUser,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.login('test@example.com', 'password')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(testUser)
    expect(localStorage.getItem('sp_access_token')).toBe('at')
    // Refresh token must never be stored in localStorage — it lives in an HttpOnly cookie.
    expect(localStorage.getItem('sp_refresh_token')).toBeNull()
  })

  it('logout clears tokens and user', async () => {
    localStorage.setItem('sp_user', JSON.stringify(testUser))
    localStorage.setItem('sp_access_token', 'at')
    mockAuthService.logout.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('sp_access_token')).toBeNull()
  })

  it('logout clears local state even if the API call fails', async () => {
    localStorage.setItem('sp_user', JSON.stringify(testUser))
    localStorage.setItem('sp_access_token', 'at')
    mockAuthService.logout.mockRejectedValueOnce(new Error('network'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('updateProfile updates user name in state and localStorage', async () => {
    localStorage.setItem('sp_user', JSON.stringify(testUser))
    mockAuthService.updateProfile.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.updateProfile({ fullName: 'Updated Name' })
    })

    expect(result.current.user?.name).toBe('Updated Name')
    const stored = JSON.parse(localStorage.getItem('sp_user')!)
    expect(stored.name).toBe('Updated Name')
  })

  it('throws when useAuth is called outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow()
  })

  it('renders children and passes context through JSX', async () => {
    mockAuthService.login.mockResolvedValueOnce({
      accessToken: 'at',
      user: testUser,
    })

    function LoginButton() {
      const { login, isAuthenticated } = useAuth()
      return isAuthenticated ? (
        <span>Logged in</span>
      ) : (
        <button onClick={() => login('e@e.com', 'p')}>Login</button>
      )
    }

    render(
      <AuthProvider>
        <LoginButton />
      </AuthProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Login' }))
    await screen.findByText('Logged in')
  })
})
