import { expect, test } from '@playwright/test'
import { setupAuthenticatedStudyApp } from './fixtures'

/**
 * Write-path flows, as opposed to the read-only navigation covered by application.spec.ts and
 * pages.spec.ts. These exercise POST/PATCH/DELETE calls and the UI's reaction to the response, which
 * is where the "successful response with an unexpected shape slips past a truthy check" bugs live
 * (see the memory of the July 2026 e2e repair — NotificationBell, TodayProgressHero, XpDigestCards).
 */

test.describe('Flashcard review session', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/flashcards')
    await page.getByRole('button', { name: /review queue/i }).click()
  })

  test('rating a card posts the review and advances the session', async ({ page }) => {
    const reviewRequest = page.waitForRequest(req =>
      /\/api\/flashcards\/[^/]+\/review$/.test(new URL(req.url()).pathname) && req.method() === 'POST',
    )

    await page.getByRole('button', { name: /start review/i }).click()

    // Card front is showing; the answer/rating controls are not until it's flipped.
    await expect(page.getByText(/1 \/ 2/)).toBeVisible()
    await expect(page.getByRole('button', { name: /^good$/i })).toBeHidden()

    await page.getByText(/click to reveal answer/i).click()
    await expect(page.getByRole('button', { name: /^good$/i })).toBeVisible()

    await page.getByRole('button', { name: /^good$/i }).click()

    const request = await reviewRequest
    expect(request.postDataJSON()).toEqual({ rating: 3 })

    // Second card of the two-card session (one due, one new — see fixtures.ts).
    await expect(page.getByText(/2 \/ 2/)).toBeVisible()
  })

  test('completing the session shows the results screen', async ({ page }) => {
    await page.getByRole('button', { name: /start review/i }).click()

    for (let i = 0; i < 2; i++) {
      await page.getByText(/click to reveal answer/i).click()
      await page.getByRole('button', { name: /^easy$/i }).click()
    }

    await expect(page.getByText('100%')).toBeVisible()
    await expect(page.getByRole('button', { name: /^done$/i })).toBeVisible()
  })

  test('rating "again" is reflected in the session tally', async ({ page }) => {
    await page.getByRole('button', { name: /start review/i }).click()

    await page.getByText(/click to reveal answer/i).click()
    await page.getByRole('button', { name: /^again$/i }).click()

    await expect(page.getByText('0✓')).toBeVisible()
    await expect(page.getByText('1✗')).toBeVisible()
  })
})

test.describe('Deleting a document from the library', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/library')
  })

  test('confirms via the delete modal, calls the API, and removes the card', async ({ page }) => {
    // A link locator, not getByText: the confirmation modal repeats the filename in quotes
    // ("Photosynthesis Article"), which a plain text locator also matches once the modal is open.
    const cardTitle = page.getByRole('link', { name: 'Photosynthesis Article' })
    await expect(cardTitle).toBeVisible()

    const card = page.locator('.group.relative').filter({ hasText: 'Photosynthesis Article' })
    await card.hover()
    await card.getByRole('button', { name: /delete document/i }).click()

    // Cancelling must not call the API or remove the card.
    await page.getByRole('button', { name: /^cancel$/i }).click()
    await expect(page.getByRole('heading', { name: 'Delete document' })).toBeHidden()
    await expect(cardTitle).toBeVisible()

    await card.getByRole('button', { name: /delete document/i }).click()
    await expect(page.getByRole('heading', { name: 'Delete document' })).toBeVisible()
    await expect(page.getByText('"Photosynthesis Article"')).toBeVisible() // confirmation copy names the item

    const deleteRequest = page.waitForRequest(req =>
      /\/api\/courses\/[^/]+\/documents\/doc-article$/.test(new URL(req.url()).pathname)
      && req.method() === 'DELETE',
    )
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await deleteRequest

    await expect(page.getByRole('heading', { name: 'Delete document' })).toBeHidden()
    await expect(cardTitle).toBeHidden()
    // The rest of the library is unaffected.
    await expect(page.getByText('Cell Biology.pdf')).toBeVisible()

    // The deletion also has to survive a refetch, not just the optimistic removal.
    await page.reload()
    await expect(cardTitle).toBeHidden()
  })
})

test.describe('Signing out', () => {
  test('clears the session and returns to the login page', async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/dashboard')

    await page.getByRole('button', { name: 'Test Student' }).click()
    await page.getByRole('button', { name: /sign out/i }).click()

    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate(() => window.localStorage.getItem('sp_access_token'))).toBeNull()
    expect(await page.evaluate(() => window.localStorage.getItem('sp_user'))).toBeNull()
  })
})

test.describe('Submitting a document quiz', () => {
  test('grades the answer, posts the submission, and shows the result', async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/documents/doc-cells')
    await page.getByRole('button', { name: 'Quiz', exact: true }).click()

    await expect(page.getByText('What organelle generates ATP?')).toBeVisible()

    const submissionRequest = page.waitForRequest(req =>
      /\/api\/courses\/[^/]+\/documents\/doc-cells\/quiz\/submission$/.test(new URL(req.url()).pathname)
      && req.method() === 'POST',
    )

    await page.getByRole('button', { name: 'Mitochondria', exact: true }).click()
    await page.getByRole('button', { name: /submit all answers/i }).click()

    const request = await submissionRequest
    expect(request.postDataJSON()).toMatchObject({
      answers: { 'quiz-cells-1': 'Mitochondria' },
      score: 1,
      total: 1,
    })

    await expect(page.getByText('Quiz Results')).toBeVisible()
    await expect(page.getByText(/you scored/i)).toContainText('1')
  })
})

test.describe('Creating a course', () => {
  test('adds it to the course picker and it survives a refetch', async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/library/add')

    await page.getByRole('button', { name: /new course/i }).click()
    const nameInput = page.getByPlaceholder('Course name')
    await nameInput.fill('Organic Chemistry')

    const createRequest = page.waitForRequest(req =>
      new URL(req.url()).pathname === '/api/courses' && req.method() === 'POST',
    )
    await nameInput.press('Enter')

    const request = await createRequest
    expect(request.postDataJSON()).toMatchObject({ courseName: 'Organic Chemistry' })
    await expect(page.getByText('Organic Chemistry')).toBeVisible()

    // Not just optimistic: a fresh load must still show it via GET /api/courses.
    await page.reload()
    await expect(page.getByText('Organic Chemistry')).toBeVisible()
  })
})
