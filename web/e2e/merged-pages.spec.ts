import { expect, test } from '@playwright/test'
import { setupAuthenticatedStudyApp } from './fixtures'

/**
 * Pages that answered the same question were merged into one page with tabs, and every retired
 * route stayed alive as a redirect into the tab that replaced it. This covers both halves of that:
 * the redirect lands on the right URL, and the right tab is selected when it gets there.
 */
const routes: [string, RegExp, RegExp][] = [
  // path, expected final URL, expected selected tab
  ['/spaces', /\/spaces/, /study groups/i],
  ['/groups', /\/spaces\?tab=groups/, /study groups/i],
  ['/classrooms', /\/spaces\?tab=classrooms/, /classrooms/i],
  ['/quizzes', /\/quizzes/, /^practice$/i],
  ['/practice', /\/quizzes\?tab=practice/, /^practice$/i],
  ['/planner', /\/quizzes\?tab=planner/, /planner/i],
  ['/mistakes', /\/quizzes\?tab=mistakes/, /review mistakes/i],
  ['/materials', /\/materials/, /^notes$/i],
  ['/notes', /\/materials\?tab=notes/, /^notes$/i],
  ['/glossary', /\/materials\?tab=glossary/, /glossary/i],
  ['/insights', /\/insights/, /analytics/i],
  ['/knowledge-graph', /\/insights\?tab=graph/, /concept map/i],
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

test('probe /feedback lands on the settings feedback tab', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await setupAuthenticatedStudyApp(page)
  await page.goto('/feedback')
  await expect(page).toHaveURL(/\/settings\?tab=feedback/)
  await expect(page.getByRole('heading', { name: /^feedback$/i })).toBeVisible()
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

test('probe the code scratchpad moved from the Practice Center to Study tools', async ({ page }) => {
  await setupAuthenticatedStudyApp(page)
  await page.goto('/quizzes?tab=code')
  await expect(page).toHaveURL(/\/tools\?tab=code/)
  await expect(page.getByRole('tab', { name: /^code$/i })).toHaveAttribute('aria-selected', 'true')
})

test('probe switching tabs keeps a mounted panel alive', async ({ page }) => {
  await setupAuthenticatedStudyApp(page)
  await page.goto('/materials')
  await page.getByPlaceholder(/search notes/i).fill('telophase')
  await page.getByRole('tab', { name: /glossary/i }).click()
  await expect(page).toHaveURL(/tab=glossary/)
  await page.getByRole('tab', { name: /^notes$/i }).click()
  // The panel was hidden, not unmounted, so the typed filter is still there.
  await expect(page.getByPlaceholder(/search notes/i)).toHaveValue('telophase')
})
