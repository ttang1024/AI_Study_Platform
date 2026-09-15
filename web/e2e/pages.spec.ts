import { expect, test } from '@playwright/test'
import { setupAuthenticatedStudyApp } from './fixtures'

// ─── Landing page (unauthenticated) ───────────────────────────────────────────

test.describe('Landing page', () => {
  test('shows the main marketing content and sign-in link', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/your complete study suite/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible()
  })

  // The format count is a public claim about what the uploader accepts; if the
  // allowlist ever shrinks below it, this is the reminder to restate it.
  test('leads the feature grid with the supported-format card', async ({ page }) => {
    await page.goto('/')

    const card = page.getByRole('heading', { name: /reads 230\+ formats/i })
    await card.scrollIntoViewIfNeeded()
    await expect(card).toBeVisible()
    await expect(page.getByText('+220 more')).toBeVisible()
  })
})

// ─── Authenticated pages ───────────────────────────────────────────────────────

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/settings')
  })

  test('shows settings heading and user profile section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Test Student' })).toBeVisible()
    await expect(page.getByText('student@example.com')).toBeVisible()
  })

  test('shows the security tab with the password form', async ({ page }) => {
    await page.getByRole('button', { name: /security/i }).click()

    await expect(page.getByRole('heading', { name: 'Password' })).toBeVisible()
  })

  test('offers a data export and account deletion behind a typed confirmation', async ({ page }) => {
    await page.getByRole('button', { name: /security/i }).click()

    await expect(page.getByRole('button', { name: /request an export/i })).toBeVisible()

    // Disabled until both the password and the exact phrase are present — the whole point of the
    // second field is that a misclick cannot reach this button.
    const deleteButton = page.getByRole('button', { name: /delete my account/i })
    await expect(deleteButton).toBeDisabled()
    await page.getByLabel(/your password/i).fill('hunter2')
    await expect(deleteButton).toBeDisabled()
    await page.getByLabel(/to confirm/i).fill('DELETE MY ACCOUNT')
    await expect(deleteButton).toBeEnabled()
  })
})

// ─── Glossary ─────────────────────────────────────────────────────────────────

test.describe('Glossary page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/glossary')
  })

  test('shows its heading and description', async ({ page }) => {
    await expect(page).toHaveURL(/\/glossary/)
    await expect(page.getByRole('heading', { name: /glossary of terms/i })).toBeVisible()
    await expect(page.getByText(/ai-extracted key terms/i)).toBeVisible()
  })

  test('shows empty state when no terms exist', async ({ page }) => {
    // Fixture returns empty glossary
    await expect(page.getByText(/generate glossaries from your content/i)).toBeVisible()
  })
})

// ─── Reinforcement Center page ─────────────────────────────────────────────────

test.describe('Reinforcement Center page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/reinforcement-center')
  })

  // The standalone page was merged into Insights as a tab; /reinforcement-center is now
  // a back-compat redirect (see ReinforcementRedirect in App.tsx). Assert that redirect
  // still holds, rather than the retired page title.
  test('redirects into the Insights analytics tab and shows its description', async ({ page }) => {
    await expect(page).toHaveURL(/\/insights\?tab=analytics/)
    await expect(page.getByText(/weak spots worth reinforcing/i)).toBeVisible()
  })

  test('shows the three study modules', async ({ page }) => {
    await expect(page.getByRole('button', { name: /quiz mistakes/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /unmastered glossary/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /hard flashcards/i })).toBeVisible()
  })
})

// ─── Search page ───────────────────────────────────────────────────────────────

test.describe('Search page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
  })

  test('renders search input when navigated to directly', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByPlaceholder(/search documents, notes, flashcards/i)).toBeVisible()
  })

  test('updates URL query param when searching', async ({ page }) => {
    await page.goto('/search')
    await page.getByPlaceholder(/search documents, notes, flashcards/i).fill('mitosis')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/q=mitosis/)
  })

  test('renders server results for a query', async ({ page }) => {
    await page.goto('/search?q=mitochondria')
    await expect(page.getByText(/cellular respiration/i)).toBeVisible()
  })

  // The only route into this page: the command palette matches loaded text only, so anything the
  // server knows and the client does not is unreachable without this row.
  test('is reachable from the command palette', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /^search/i }).first().click()

    const palette = page.getByPlaceholder(/search documents, flashcards, quizzes/i)
    await expect(palette).toBeVisible()
    await palette.fill('mitochondria')

    await page.getByText(/search everything for/i).click()

    await expect(page).toHaveURL(/\/search\?q=mitochondria/)
    await expect(page.getByText(/cellular respiration/i)).toBeVisible()
  })

  test('answers the query from the library with citations', async ({ page }) => {
    await page.goto('/search?q=mitochondria')
    await page.getByRole('button', { name: /ask ai/i }).click()

    await expect(page.getByText(/mitochondria generate atp/i)).toBeVisible()
    await expect(page.getByText('Cell Biology.pdf').first()).toBeVisible()
  })
})

// ─── Document detail page ──────────────────────────────────────────────────────

test.describe('Document detail page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
  })

  test('shows the document filename in the header', async ({ page }) => {
    await page.goto('/documents/doc-cells')
    await expect(page.getByRole('heading', { name: 'Cell Biology.pdf' })).toBeVisible()
  })

  test('shows the summary tab content', async ({ page }) => {
    await page.goto('/documents/doc-cells')
    await expect(page.getByText(/cells are the basic unit of life/i)).toBeVisible()
  })

  test('renders a source file with line numbers instead of raw text', async ({ page }) => {
    await page.goto('/documents/doc-script')

    const firstLine = page.getByRole('row').first()
    await expect(firstLine.getByRole('cell').first()).toHaveText('1')
    await expect(page.getByText('# sum them up')).toBeVisible()
  })

  test('renders a csv as a table', async ({ page }) => {
    await page.goto('/documents/doc-grades')

    await expect(page.getByRole('columnheader', { name: 'student' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Ada' })).toBeVisible()
  })

  test('renders a notebook as cells with their outputs', async ({ page }) => {
    await page.goto('/documents/doc-lab')

    await expect(page.getByRole('heading', { name: 'Lab notes' })).toBeVisible()
    await expect(page.getByText('In [1]')).toBeVisible()
  })

  test('renders captions as a timestamped transcript', async ({ page }) => {
    await page.goto('/documents/doc-captions')

    await expect(page.getByText('0:01')).toBeVisible()
    await expect(page.getByText('Mitochondria make ATP')).toBeVisible()
  })
})

// ─── Library → detail page navigation ─────────────────────────────────────────

test.describe('Library navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/library')
  })

  test('clicking a document navigates to its detail page', async ({ page }) => {
    await page.getByText('Cell Biology.pdf').click()
    await expect(page).toHaveURL(/\/documents\/doc-cells/)
    await expect(page.getByText('Cell Biology.pdf')).toBeVisible()
  })

  test('clicking a video navigates to its detail page', async ({ page }) => {
    await page.getByRole('button', { name: /videos/i }).click()
    await page.getByText('Mitosis Explained').click()
    await expect(page).toHaveURL(/\/videos\/video-mitosis/)
  })
})

test.describe('Dashboard page', () => {
  test('the hero card links straight to the Add content page', async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/dashboard')
    // Scoped to the page body — the sidebar has an Add Content entry of its own now.
    await page.getByRole('main').getByRole('link', { name: /add content/i }).click()
    await expect(page).toHaveURL(/\/library\/add$/)
    await expect(page.getByRole('heading', { name: /turn anything into study material/i })).toBeVisible()
  })
})
