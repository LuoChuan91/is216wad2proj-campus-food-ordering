import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'
import { placeE2EDeliveryOrder } from '../fixtures/order.js'
import { rest } from '../fixtures/db.js'

test('a delivery nobody accepts switches to pickup and waives the fee', async ({ page }) => {
  await signIn(page, ACCOUNTS.student)
  await placeE2EDeliveryOrder(page)

  // The order id is the last part of /student/orders/<id>
  const orderId = page.url().split('/').pop()

  // Force the courier window into the past, then let the app notice on its next read
  const deliveries = await rest(`deliveries?select=id&order_id=eq.${orderId}`)
  expect(deliveries.length).toBeGreaterThan(0)
  await rest(`deliveries?id=eq.${deliveries[0].id}`, {
    method: 'PATCH',
    body: { expires_at: new Date(Date.now() - 60_000).toISOString() },
  })

  // Leave and re-enter the order so the app refetches (which runs the expiry check)
  await page.getByRole('button', { name: 'Back' }).first().click()
  await page.locator('nav[aria-label="Student sections"] button[aria-label="Orders"]').click()
  await page.getByText(/E2E Test Kitchen/).filter({ visible: true }).first().click()

  await expect(page.locator('.fallback-note')).toBeVisible({ timeout: 30000 })
})
