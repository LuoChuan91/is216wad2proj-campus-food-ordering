import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'
import { placeE2EOrder, BASE_URL } from '../fixtures/order.js'

test('the merchant moves a new order to ready', async ({ page, browser }) => {
  // A student places an order in its own browser context
  const studentContext = await browser.newContext({ baseURL: BASE_URL })
  const studentPage = await studentContext.newPage()
  await signIn(studentPage, ACCOUNTS.student)
  const code = await placeE2EOrder(studentPage)
  await studentContext.close()

  // The merchant handles it
  await signIn(page, ACCOUNTS.merchant)
  await expect(page).toHaveURL(/\/merchant/)

  const card = page.locator('.ocard').filter({ hasText: `#${code}` }).first()
  await expect(card).toBeVisible({ timeout: 25000 })

  await card.getByRole('button', { name: /Start cooking/i }).click()
  await expect(card.getByRole('button', { name: /Mark ready/i })).toBeVisible({ timeout: 20000 })
  await card.getByRole('button', { name: /Mark ready/i }).click()

  // It ends up in the Ready column
  await expect(page.locator('.col-ready .ocard').filter({ hasText: `#${code}` })).toBeVisible({ timeout: 20000 })
})
