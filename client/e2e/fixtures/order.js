// Places a real order for the E2E test dish and leaves the browser on the
// tracking page. Returns the order code (e.g. "6D38") for later assertions.
//
// Assumes the page is already signed in as a student and showing the student app.
import { expect } from '@playwright/test'

const storesTab = (page) => page.locator('nav[aria-label="Student sections"] button[aria-label="Stores"]')

export const BASE_URL = 'http://localhost:5173'

export async function placeE2EOrder(page) {
  await storesTab(page).click()

  await page.getByRole('button', { name: /E2E Test Kitchen/ }).click()
  await expect(page).toHaveURL(/\/student\/store\//)

  await page.getByRole('button', { name: /E2E Test Dish/ }).click()
  await page.getByRole('button', { name: /Add to cart/i }).click()
  await page.getByRole('button', { name: /View cart/i }).click()
  await expect(page).toHaveURL(/\/student\/checkout/)

  await page.getByRole('button', { name: /^Pay \$/ }).click()

  const pay = page.getByRole('dialog', { name: 'Payment' })
  await expect(pay).toBeVisible()
  await pay.getByRole('button', { name: /Confirm payment/i }).click()
  await expect(page.getByText(/Payment successful/i)).toBeVisible({ timeout: 25000 })

  await page.getByRole('button', { name: /Track my order/i }).click()
  await expect(page).toHaveURL(/\/student\/orders\//)

  const heading = page.getByRole('heading', { name: /Order #/ })
  await expect(heading).toBeVisible()
  return (await heading.innerText()).replace(/[^0-9A-Za-z]/g, '').replace(/^Order/, '')
}
