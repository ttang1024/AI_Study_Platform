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

  test('shows the security tab: password, two-factor, sessions and the log', async ({ page }) => {
    await page.getByRole('button', { name: /security/i }).click()

    // The tab grew from a bare password form into the account-security hub, so it asserts on
    // each section rather than one heading — a missing section is the failure worth catching.
    await expect(page.getByRole('heading', { name: 'Password' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /two-factor authentication/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /security log/i })).toBeVisible()
  })

  test('the sessions list flags the current device and the log reads in plain English', async ({ page }) => {
    await page.getByRole('button', { name: /security/i }).click()

    await expect(page.getByText('Chrome on macOS')).toBeVisible()
    await expect(page.getByText('This device')).toBeVisible()
    // Exact, because "signed in" also appears in the section blurb and in each session's
    // "signed in <date>" line. The raw key is "auth.login.succeeded"; the point of the label
    // map is that it never reaches the page.
    await expect(page.getByText('Signed in', { exact: true })).toBeVisible()
    await expect(page.getByText('auth.login.succeeded')).toHaveCount(0)
  })

  test('offers a data export and account deletion behind a typed confirmation', async ({ page }) => {
    await page.getByRole('button', { name: /your data/i }).click()

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

// ─── Glossary (a tab of the Materials page) ────────────────────────────────────

test.describe('Glossary page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedStudyApp(page)
    await page.goto('/glossary')
  })

  test('redirects into the Materials glossary tab and shows its description', async ({ page }) => {
    await expect(page).toHaveURL(/\/materials\?tab=glossary/)
    await expect(page.getByRole('heading', { name: /study materials/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /glossary/i })).toHaveAttribute('aria-selected', 'true')
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
  test('redirects into the Insights reinforcement tab and shows its description', async ({ page }) => {
    await expect(page).toHaveURL(/\/insights\?tab=reinforcement/)
    await expect(page.getByText(/strengthen weak areas/i)).toBeVisible()
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
