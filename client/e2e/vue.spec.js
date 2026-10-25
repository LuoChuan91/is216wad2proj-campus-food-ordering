import { test, expect } from '@playwright/test'

// End-to-end: the sign-in screen loads real accounts from the server, and
// picking one opens that person's portal.

test('signs in as a student and opens the student app', async ({ page }) => {
  await page.goto('/')

  // Accounts come from GET /api/profiles, so this also proves the server is wired up.
  await expect(page.locator('.signin')).toBeVisible({ timeout: 15000 })
  const firstAccount = page.locator('.si-acct').first()
  await expect(firstAccount).toBeVisible()

  await firstAccount.click()

  // The student shell: the five-tab bottom bar
  await expect(page.locator('.tabbar')).toBeVisible()
  await expect(page.getByRole('button', { name: /Stores/ })).toBeVisible()
})

test('a student can open the store list', async ({ page }) => {
  await page.goto('/')
  await page.locator('.si-acct').first().click()
  await page.getByRole('button', { name: /Stores/ }).click()

  await expect(page.locator('.store-card').first()).toBeVisible()
})
