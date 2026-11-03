import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'

// Navigate inside the app (no reload): a hard page.goto to a protected route can
// run the router guard before Supabase has restored the session.
const storesTab = (page) => page.locator('nav[aria-label="Student sections"] button[aria-label="Stores"]')

test.describe('student browsing', () => {
  test('the campus map renders', async ({ page }) => {
    await signIn(page, ACCOUNTS.student)

    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/Near you/i).first()).toBeVisible()
  })

  test('the store list opens a store and shows its live wait', async ({ page }) => {
    await signIn(page, ACCOUNTS.student)

    await storesTab(page).click()
    await expect(page).toHaveURL(/\/student\/stores/)
    await expect(page.getByRole('heading', { name: /All stores/i })).toBeVisible()

    // Any store: the list changes as the team edits the data, so don't hard-code a name
    const card = page.locator('button.store-card').first()
    await expect(card).toBeVisible()
    const name = (await card.innerText()).split('\n')[0].trim()

    await card.click()
    await expect(page).toHaveURL(/\/student\/store\//)
    await expect(page.locator('.store-page').getByText(name).first()).toBeVisible()

    // the wait-time engine badge: "~X min" once loaded (or its loading state)
    await expect(page.locator('.store-page').getByText(/~\s?\d+\s?min|Estimating wait/i).first()).toBeVisible({ timeout: 20000 })
  })
})
