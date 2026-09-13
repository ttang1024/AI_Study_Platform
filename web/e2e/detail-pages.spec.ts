import { expect, test } from '@playwright/test'
import { setupAuthenticatedStudyApp } from './fixtures'

/**
 * Content-level coverage for detail pages that previously only got a URL check (or none at all)
 * from the rest of the suite: VideoDetailPage, ArticlePage, AudioDetailPage. Each fetches its own
 * data independently of the library list, so a broken payload shape here wouldn't have shown up
 * anywhere else in the suite.
 */

test.describe('Video detail page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/videos/video-mitosis')
  })

  test('shows the video title and summary', async ({ page }) => {
    await expect(page.getByText('Mitosis Explained')).toBeVisible()
    await expect(page.getByText(/mitosis creates identical daughter cells/i)).toBeVisible()
  })
})

test.describe('Article page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/articles/doc-article')
  })

  test('shows the article title and summary', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Photosynthesis Article' })).toBeVisible()
    await expect(page.getByText(/photosynthesis converts light into chemical energy/i)).toBeVisible()
  })
})

test.describe('Audio detail page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/audio/doc-audio-lecture')
  })

  test('shows the file name and summary without triggering auto-transcribe', async ({ page }) => {
    const transcribeRequest = page.waitForRequest(
      req => /\/audio\/doc-audio-lecture\/transcribe$/.test(new URL(req.url()).pathname),
      { timeout: 2000 },
    ).catch(() => null)

    await expect(page.getByText('Neuroscience Lecture.mp3').first()).toBeVisible()
    await expect(page.getByText(/neurons communicate through electrochemical signals/i).first()).toBeVisible()

    // A pre-filled transcript should short-circuit useAudioDetail's transcribe-on-load path.
    expect(await transcribeRequest).toBeNull()
  })
})
