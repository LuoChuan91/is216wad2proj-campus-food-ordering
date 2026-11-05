// Walks the student ordering flow for the E2E test dish.
// Assumes the page is already signed in as a student and showing the student app.
import { expect } from '@playwright/test'

const storesTab = (page) => page.locator('nav[aria-label="Student sections"] button[aria-label="Stores"]')

export const BASE_URL = 'http://localhost:5173'

// Store -> dish -> cart -> checkout. Leaves the page on the checkout screen.
export async function addE2EDishToCart(page) {
  await storesTab(page).click()

  await page.locator('button.store-card').filter({ hasText: /E2E Test Kitchen/ }).first().click()
  await expect(page).toHaveURL(/\/student\/store\//)

  await page.locator('button.menu-item').filter({ hasText: /E2E Test Dish/ }).first().click()
  await page.getByRole('button', { name: /Add to cart/i }).click()
  await page.getByRole('button', { name: /View cart/i }).click()
  await expect(page).toHaveURL(/\/student\/checkout/)
}

// Checkout -> pay -> tracking. Returns the order code (e.g. "6D38").
export async function payAndTrack(page) {
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

export async function placeE2EOrder(page) {
  await addE2EDishToCart(page)
  return payAndTrack(page)
}

// Same, but chooses peer delivery and the first drop-off point.
export async function placeE2EDeliveryOrder(page) {
  await addE2EDishToCart(page)

  // Bootstrap hides the radio input (btn-check), so click its label
  await page.locator('label[for="fulfil-delivery"]').click()

  const drop = page.locator('.drop').first()
  await expect(drop).toBeVisible({ timeout: 15000 })
  await drop.click()

  return payAndTrack(page)
}
