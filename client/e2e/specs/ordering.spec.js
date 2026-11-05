import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'
import { placeE2EOrder } from '../fixtures/order.js'

test.describe('ordering', () => {
  test('a student orders, pays and sees the order in history', async ({ page }) => {
    await signIn(page, ACCOUNTS.student)
    const code = await placeE2EOrder(page)

    // the tracking page opens with the store and a live status
    await expect(page.getByText(/E2E Test Kitchen/).first()).toBeVisible()
    await expect(
      page.getByText(/In the queue|Being prepared|Your food is ready|Ready for pickup/i).first(),
    ).toBeVisible({ timeout: 20000 })

    // the order is also in the history list (leave the tracking page first)
    await page.getByRole('button', { name: 'Back' }).first().click()
    await page.locator('nav[aria-label="Student sections"] button[aria-label="Orders"]').click()
    await expect(page).toHaveURL(/\/student\/orders$/)
    await expect(page.getByText(`#${code}`).filter({ visible: true }).first()).toBeVisible()
  })
})
