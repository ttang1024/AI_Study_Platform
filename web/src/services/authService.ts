import { apiClient } from './apiClient'
import { User } from '../types'

interface LoginResponse {
	accessToken: string
	expiresAt: string
	user: User
}

const mapUser = (backendUser: { userId: string; email: string; fullName: string }): User => ({
	id: backendUser.userId,
	email: backendUser.email,
	name: backendUser.fullName,
})

export const authService = {
	async sendOtp(email: string, purpose: 'registration' | 'passwordReset'): Promise<void> {
		await apiClient.post('/api/auth/send-otp', { email, purpose })
	},

	async register(data: {
		email: string
		fullName: string
		password: string
		otpCode: string
	}): Promise<void> {
		await apiClient.post('/api/auth/register', data)
	},

	async login(email: string, password: string): Promise<LoginResponse> {
		const response = await apiClient.post('/api/auth/login', { email, password })
		const { accessToken, expiresAt, ...backendUser } = response.data.data
		return {
			accessToken,
			expiresAt,
			user: mapUser(backendUser),
		}
	},

	// Refresh token is sent automatically via the HttpOnly cookie (withCredentials).
	async refreshToken(): Promise<{ accessToken: string }> {
		const response = await apiClient.post('/api/auth/refresh-token', {})
		return response.data.data
	},

	async resetPassword(data: {
		email: string
		otpCode: string
		newPassword: string
	}): Promise<void> {
		await apiClient.post('/api/auth/reset-password', data)
	},

	async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
		await apiClient.post('/api/auth/change-password', data)
	},

	async updateProfile(data: { fullName: string }): Promise<void> {
		await apiClient.put('/api/auth/update-profile', data)
	},

	async loginWithOAuth(provider: string, code: string, redirectUri: string): Promise<LoginResponse> {
		const response = await apiClient.post('/api/auth/oauth', { provider, code, redirectUri })
		const { accessToken, expiresAt, ...backendUser } = response.data.data
		return {
			accessToken,
			expiresAt,
			user: mapUser(backendUser),
		}
	},

	async loginWithGoogleCredential(credential: string): Promise<LoginResponse> {
		const response = await apiClient.post('/api/auth/google-credential', { credential })
		const { accessToken, expiresAt, ...backendUser } = response.data.data
		return {
			accessToken,
			expiresAt,
			user: mapUser(backendUser),
		}
	},

	// Refresh token is revoked server-side via the HttpOnly cookie (withCredentials).
	async logout(): Promise<void> {
		await apiClient.post('/api/auth/logout', {})
	},
}
