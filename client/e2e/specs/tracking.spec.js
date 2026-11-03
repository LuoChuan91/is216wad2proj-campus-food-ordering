import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'
import { placeE2EOrder, BASE_URL } from '../fixtures/order.js'

test('the student tracking page updates when the merchant marks the order ready', async ({ page, browser }) => {
  // Student places the order and stays on the tracking page
  await signIn(page, ACCOUNTS.student)
  const code = await placeE2EOrder(page)
  await expect(page.getByText(/In the queue|Being prepared/i).first()).toBeVisible({ timeout: 20000 })

  // Merchant works the order in a second browser context
  const merchantContext = await browser.newContext({ baseURL: BASE_URL })
  const merchantPage = await merchantContext.newPage()
  await signIn(merchantPage, ACCOUNTS.merchant)

  const card = merchantPage.locator('.ocard').filter({ hasText: `#${code}` }).first()
  await expect(card).toBeVisible({ timeout: 25000 })
  await card.getByRole('button', { name: /Start cooking/i }).click()
  await expect(card.getByRole('button', { name: /Mark ready/i })).toBeVisible({ timeout: 20000 })
  await card.getByRole('button', { name: /Mark ready/i }).click()

  // The student page updates without a reload
  await expect(
    page.getByText(/Your food is ready|Ready for pickup/i).first(),
  ).toBeVisible({ timeout: 30000 })

  await merchantContext.close()
})
