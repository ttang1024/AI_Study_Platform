import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ google: 'google-id' as string | undefined, github: 'github-id' as string | undefined }))

vi.mock('../../../utils/oauth', () => ({
  get GOOGLE_CLIENT_ID() { return mocks.google },
  get GITHUB_CLIENT_ID() { return mocks.github },
  buildOAuthUrl: (provider: string) => `https://example.test/${provider}`,
}))

const { OAuthButtons } = await import('../OAuthButtons')

const navigateTo = vi.fn()

Object.defineProperty(window, 'location', {
  configurable: true,
  value: { get origin() { return 'https://app.test' }, set href(url: string) { navigateTo(url) } },
})

afterEach(() => {
  mocks.google = 'google-id'
  mocks.github = 'github-id'
  navigateTo.mockClear()
})

describe('OAuthButtons', () => {
  it('offers both providers and the divider to the password form', () => {
    render(<OAuthButtons verb="Continue" />)

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument()
    expect(screen.getByText('or')).toBeInTheDocument()
  })

  it('takes the verb from the page it is on', () => {
    render(<OAuthButtons verb="Sign up" />)

    expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign up with github/i })).toBeInTheDocument()
  })

  it.each([
    [/google/i, 'https://example.test/google'],
    [/github/i, 'https://example.test/github'],
  ])('starts the %s handshake', async (name, url) => {
    render(<OAuthButtons verb="Continue" />)

    await userEvent.setup().click(screen.getByRole('button', { name }))

    expect(navigateTo).toHaveBeenCalledWith(url)
  })

  it('disables a provider that has no client id, rather than hiding it', async () => {
    mocks.google = undefined
    render(<OAuthButtons verb="Continue" />)

    const google = screen.getByRole('button', { name: /google/i })
    // Visible-but-disabled makes a missing key obvious instead of silently dropping a login route.
    expect(google).toBeInTheDocument()
    expect(google).toBeDisabled()
    expect(screen.getByRole('button', { name: /github/i })).toBeEnabled()

    await userEvent.setup().click(google)
    expect(navigateTo).not.toHaveBeenCalled()
  })
})
