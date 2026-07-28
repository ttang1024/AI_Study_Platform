// Service logic moved to the shared package (packages/core) — rn/ had the same
// endpoints and the same user mapping. This file wires the web HTTP adapter into
// the shared factory and keeps web's response shape (accessToken + expiresAt;
// the refresh token lives in an HttpOnly cookie, so web never reads it).
import { createAuthService } from '@core/services/authService'
import { http } from './http'
import { User } from '../types'

const core = createAuthService(http)

interface LoginResponse {
	accessToken: string
	expiresAt: string
	user: User
}

const toWebResult = ({
	accessToken,
	expiresAt,
	user,
}: Awaited<ReturnType<typeof core.login>>): LoginResponse => ({ accessToken, expiresAt, user })

export const authService = {
	sendOtp: core.sendOtp,

	register: core.register,

	async login(email: string, password: string): Promise<LoginResponse> {
		return toWebResult(await core.login(email, password))
	},

	// Refresh token is sent automatically via the HttpOnly cookie (withCredentials).
	refreshToken(): Promise<{ accessToken: string }> {
		return core.refreshToken()
	},

	resetPassword: core.resetPassword,

	changePassword: core.changePassword,

	updateProfile: core.updateProfile,

	async loginWithOAuth(provider: string, code: string, redirectUri: string): Promise<LoginResponse> {
		return toWebResult(await core.loginWithOAuth(provider, code, redirectUri))
	},

	async loginWithGoogleCredential(credential: string): Promise<LoginResponse> {
		return toWebResult(await core.loginWithGoogleCredential(credential))
	},

	// Refresh token is revoked server-side via the HttpOnly cookie (withCredentials).
	logout(): Promise<void> {
		return core.logout()
	},
}
