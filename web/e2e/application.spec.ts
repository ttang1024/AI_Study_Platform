import { expect, test } from '@playwright/test'
import { setupAuthenticatedStudyApp } from './fixtures'

test.describe('Authenticated application', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
  })

  test('loads the dashboard and navigates through the main app areas', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: /test student/i })).toBeVisible()
    // Scoped to the page body: several of these labels also name a sidebar entry.
    const main = page.locator('#main-scroll')
    await expect(main.getByText('Content Library')).toBeVisible()
    await expect(main.getByText('Study Tools')).toBeVisible()
    await expect(main.getByText('Biology 101')).toBeVisible()

    await page.getByRole('link', { name: /library/i }).click()
    await expect(page).toHaveURL(/\/library/)
    await expect(page.getByRole('heading', { name: 'Content Library' })).toBeVisible()

    await page.getByRole('link', { name: /flashcards/i }).click()
    await expect(page).toHaveURL(/\/flashcards/)
    await expect(page.getByRole('heading', { name: /study flashcards/i })).toBeVisible()

    // Quizzes, practice and the planner are one page with tabs now, reached from a single nav entry.
    await page.getByRole('link', { name: /practice center/i }).click()
    await expect(page).toHaveURL(/\/quizzes/)
    await expect(page.getByRole('heading', { name: /practice center/i })).toBeVisible()

    // Likewise notes and the glossary, under Materials.
    await page.getByRole('link', { name: /materials/i }).click()
    await expect(page).toHaveURL(/\/materials/)
    await expect(page.getByRole('heading', { name: /study materials/i })).toBeVisible()
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

    // Per-site buttons (YouTube/Bilibili/…) were replaced by a single link field that
    // detects the source from the URL itself — see the videoSources registry.
    await page.getByRole('button', { name: /^Video$/ }).click()
    await expect(page.getByPlaceholder(/paste a link/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /video link/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /upload video/i })).toBeVisible()

    await page.getByRole('button', { name: /^Web Article$/ }).click()
    await expect(page.getByPlaceholder(/url/i)).toBeVisible()

    // Audio splits into Podcast (the default) and Audio Lecture; the file drop zone
    // lives under Audio Lecture, so the podcast sub-tab has to be stepped past.
    await page.getByRole('button', { name: /^Audio$/ }).click()
    await expect(page.getByText(/turn any podcast into study material/i)).toBeVisible()

    await page.getByRole('button', { name: /audio lecture/i }).click()
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
    // The Practice Center opens on Practice; history is a tab of the same page.
    await page.goto('/quizzes?tab=history')

    await expect(page.getByRole('heading', { name: /practice center/i })).toBeVisible()
    await expect(page.getByText('Cell Biology.pdf')).toBeVisible()
    await expect(page.getByText('4/5')).toBeVisible()

    await page.getByRole('tab', { name: /question bank/i }).click()
    await expect(page.getByPlaceholder(/search questions/i)).toBeVisible()
    await expect(page.getByText('Which organelle makes ATP?')).toBeVisible()

    await page.getByRole('tab', { name: /review mistakes/i }).click()
    // With no mistakes in the fixture the notebook shows its empty state.
    await expect(page.getByText(/no open mistakes/i)).toBeVisible()
  })

  test('shows notes across documents and videos with search filtering', async ({ page }) => {
    // /notes is a redirect into the Materials page's Notes tab.
    await page.goto('/notes')
    await expect(page).toHaveURL(/\/materials\?tab=notes/)

    await expect(page.getByRole('heading', { name: /study materials/i })).toBeVisible()
    await expect(page.getByText('Cell Biology.pdf')).toBeVisible()
    await expect(page.getByText(/mitochondria generate atp/i)).toBeVisible()
    await expect(page.getByText('Mitosis Explained')).toBeVisible()

    await page.getByPlaceholder(/search notes/i).fill('telophase')
    await expect(page.getByText('Mitosis Explained')).toBeVisible()
    await expect(page.getByText('Cell Biology.pdf')).toBeHidden()
  })
})
