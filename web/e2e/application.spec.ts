import { expect, test } from '@playwright/test'
import { setupAuthenticatedStudyApp } from './fixtures'

test.describe('Authenticated application', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
  })

  test('loads the dashboard and navigates through the main app areas', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: /test student/i })).toBeVisible()
    await expect(page.getByText('Content Library')).toBeVisible()
    await expect(page.getByText('Study Tools')).toBeVisible()
    await expect(page.getByText('Biology 101')).toBeVisible()

    await page.getByRole('link', { name: /library/i }).click()
    await expect(page).toHaveURL(/\/library/)
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()

    await page.getByRole('link', { name: /flashcards/i }).click()
    await expect(page).toHaveURL(/\/flashcards/)
    await expect(page.getByRole('heading', { name: /study flashcards/i })).toBeVisible()

    await page.getByRole('link', { name: /quizzes/i }).click()
    await expect(page).toHaveURL(/\/quizzes/)
    await expect(page.getByRole('heading', { name: /quiz center/i })).toBeVisible()

    await page.getByRole('link', { name: /notes/i }).click()
    await expect(page).toHaveURL(/\/notes/)
    await expect(page.getByRole('heading', { name: /study notes/i })).toBeVisible()
  })

  test('renders library content and supports type and search filters', async ({ page }) => {
    await page.goto('/library')

    await expect(page.getByText('Cell Biology.pdf')).toBeVisible()
    await expect(page.getByText('Mitosis Explained')).toBeVisible()
    await expect(page.getByText('Photosynthesis Article')).toBeVisible()

    await page.getByRole('button', { name: /videos/i }).click()
    await expect(page).toHaveURL(/type=videos/)
    await expect(page.getByText('Mitosis Explained')).toBeVisible()
    await expect(page.getByText('Cell Biology.pdf')).toBeHidden()

    await page.getByPlaceholder(/search by title/i).fill('missing topic')
    await expect(page.getByRole('heading', { name: /no results found/i })).toBeVisible()
  })

  test('switches summarizer input modes for an authenticated user', async ({ page }) => {
    await page.goto('/summarizer')

    await expect(page.getByRole('heading', { name: /turn anything into study material/i })).toBeVisible()
    await expect(page.getByText('Biology 101').first()).toBeVisible()

    await page.getByRole('button', { name: /^YouTube$/ }).click()
    await expect(page.getByText(/youtube/i).first()).toBeVisible()
    await expect(page.getByPlaceholder(/youtube.*url|video.*url/i)).toBeVisible()

    await page.getByRole('button', { name: /^Web Article$/ }).click()
    await expect(page.getByPlaceholder(/url/i)).toBeVisible()

    await page.getByRole('button', { name: /^Audio$/ }).click()
    await expect(page.getByText(/drop your audio file here/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /start learning/i })).toBeVisible()
  })

  test('shows flashcard sets, review queue, and search empty state', async ({ page }) => {
    await page.goto('/flashcards')

    await expect(page.getByRole('heading', { name: /study flashcards/i })).toBeVisible()
    await expect(page.getByText('Cell Biology.pdf')).toBeVisible()
    await expect(page.getByText('Mitosis Explained')).toBeVisible()

    await page.getByPlaceholder(/search sets/i).fill('unknown set')
    await expect(page.getByRole('heading', { name: /no flashcard sets found/i })).toBeVisible()

    await page.getByRole('button', { name: /review queue/i }).click()
    await expect(page.getByText(/review/i).first()).toBeVisible()
  })

  test('covers quiz history and question bank tabs', async ({ page }) => {
    await page.goto('/quizzes')

    await expect(page.getByRole('heading', { name: /quiz center/i })).toBeVisible()
    await expect(page.getByText('Cell Biology.pdf')).toBeVisible()
    await expect(page.getByText('4/5')).toBeVisible()

    await page.getByRole('button', { name: /question bank/i }).click()
    await expect(page.getByPlaceholder(/search questions/i)).toBeVisible()
    await expect(page.getByText('Which organelle makes ATP?')).toBeVisible()

    await page.getByRole('button', { name: /review mistakes/i }).click()
    await expect(page.getByText(/no failed questions found|which organelle makes atp/i)).toBeVisible()
  })

  test('shows notes across documents and videos with search filtering', async ({ page }) => {
    await page.goto('/notes')

    await expect(page.getByRole('heading', { name: /study notes/i })).toBeVisible()
    await expect(page.getByText('Cell Biology.pdf')).toBeVisible()
    await expect(page.getByText(/mitochondria generate atp/i)).toBeVisible()
    await expect(page.getByText('Mitosis Explained')).toBeVisible()

    await page.getByPlaceholder(/search notes/i).fill('telophase')
    await expect(page.getByText('Mitosis Explained')).toBeVisible()
    await expect(page.getByText('Cell Biology.pdf')).toBeHidden()
  })
})
