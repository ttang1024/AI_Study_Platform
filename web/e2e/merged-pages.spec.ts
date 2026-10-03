import { expect, test } from '@playwright/test'
import { setupAuthenticatedStudyApp } from './fixtures'

/**
 * Pages that answered the same question were merged into one page with tabs, and every retired
 * route stayed alive as a redirect into the tab that replaced it. This covers both halves of that:
 * the redirect lands on the right URL, and the right tab is selected when it gets there.
 */
const routes: [string, RegExp, RegExp][] = [
  // path, expected final URL, expected selected tab
  ['/quizzes', /\/quizzes/, /^practice$/i],
  ['/practice', /\/quizzes\?tab=practice/, /^practice$/i],
  ['/planner', /\/quizzes\?tab=planner/, /planner/i],
  ['/mistakes', /\/quizzes\?tab=mistakes/, /review mistakes/i],
  ['/insights', /\/insights/, /analytics/i],
]

for (const [path, url, tab] of routes) {
  test(`probe ${path}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await setupAuthenticatedStudyApp(page)
    await page.goto(path)
    await expect(page).toHaveURL(url)
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true')
    expect(errors).toEqual([])
  })
}

/** Notes and Glossary were two tabs of one page and are two pages again, so they are checked by heading. */
test('probe /notes and /glossary are separate pages', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await setupAuthenticatedStudyApp(page)

  await page.goto('/notes')
  await expect(page.getByRole('heading', { name: /study notes/i })).toBeVisible()

  await page.goto('/glossary')
  await expect(page.getByRole('heading', { name: /glossary of terms/i })).toBeVisible()
  expect(errors).toEqual([])
})

/**
 * Spaces lost its Classrooms half, so it is a single page again rather than a tab hub — checked by
 * heading, and /groups still has to land on it.
 */
test('probe /spaces and /groups land on the study-groups page', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await setupAuthenticatedStudyApp(page)

  await page.goto('/spaces')
  await expect(page.getByRole('heading', { name: /study groups/i })).toBeVisible()

  await page.goto('/groups')
  await expect(page).toHaveURL(/\/spaces/)
  await expect(page.getByRole('heading', { name: /study groups/i })).toBeVisible()
  expect(errors).toEqual([])
})

/**
 * Browse and Add were the two tabs of /library and are two pages now, so the library routes are
 * checked by heading rather than by selected tab.
 */
test('probe /library and /library/add are separate pages', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await setupAuthenticatedStudyApp(page)

  await page.goto('/library')
  await expect(page.getByRole('heading', { name: /content library/i })).toBeVisible()

  // Scoped to the page body — the sidebar has an Add Content entry of its own now.
  await page.getByRole('main').getByRole('link', { name: /add content/i }).click()
  await expect(page).toHaveURL(/\/library\/add$/)
  // The add page carries its own heading instead of the app's usual page header.
  await expect(page.getByRole('heading', { name: /turn anything into study material/i })).toBeVisible()

  await page.getByRole('link', { name: /^library$/i }).click()
  await expect(page).toHaveURL(/\/library$/)
  expect(errors).toEqual([])
})

test('probe /summarizer and the retired ?view=add link land on the add page', async ({ page }) => {
  await setupAuthenticatedStudyApp(page)

  await page.goto('/summarizer')
  await expect(page).toHaveURL(/\/library\/add$/)

  await page.goto('/library?view=add&type=videos')
  await expect(page).toHaveURL(/\/library\/add\?type=videos/)
})

test('probe summarizer deep link keeps its own tab param', async ({ page }) => {
  await setupAuthenticatedStudyApp(page)
  await page.goto('/summarizer?tab=web&courseId=course-bio')
  await expect(page).toHaveURL(/\/library\/add\?/)
  await expect(page).toHaveURL(/tab=web/)
  await expect(page.getByPlaceholder(/url/i)).toBeVisible()
})

test('probe practice smart deep link survives the redirect', async ({ page }) => {
  await setupAuthenticatedStudyApp(page)
  await page.goto('/practice?smart=1')
  await expect(page).toHaveURL(/\/quizzes\?tab=practice&smart=1/)
})

test('probe switching tabs keeps a mounted panel alive', async ({ page }) => {
  await setupAuthenticatedStudyApp(page)
  await page.goto('/quizzes')
  const practicePanel = page.locator('#quizzes-panel-practice')
  await expect(practicePanel).toBeVisible()

  await page.getByRole('tab', { name: /planner/i }).click()
  await expect(page).toHaveURL(/tab=planner/)
  // The panel was hidden, not unmounted — work in progress inside it survives the tab switch.
  await expect(practicePanel).toBeAttached()
  await expect(practicePanel).toBeHidden()
})
