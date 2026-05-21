import { expect, test } from '@playwright/test'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('shows the login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('shows a validation error for a weak password', async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill('user@example.com')
    await page.getByPlaceholder(/password/i).fill('weak')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/password must be/i)).toBeVisible()
  })

  test('navigates to register page via link', async ({ page }) => {
    await page.getByRole('link', { name: /create one/i }).click()
    await expect(page).toHaveURL(/\/register/)
  })

  test('shows forgot password flow on link click', async ({ page }) => {
    await page.getByRole('button', { name: /forgot/i }).click()
    await expect(page.getByRole('button', { name: /send code/i })).toBeVisible()
  })
})

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
  })

  test('shows the registration form', async ({ page }) => {
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/full name/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test('shows a password strength error for a weak password', async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill('new@example.com')
    await page.getByPlaceholder(/full name/i).fill('Test User')
    await page.getByPlaceholder(/verification code/i).fill('123456')
    await page.getByPlaceholder(/password/i).fill('short')
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByText(/password must be/i)).toBeVisible()
  })

  test('navigates to login page via link', async ({ page }) => {
    await page.getByRole('link', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Unauthenticated redirect', () => {
  test('redirects to /login when accessing a protected route', async ({ page }) => {
    await page.goto('/summarizer')
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirects to /login when accessing /dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
