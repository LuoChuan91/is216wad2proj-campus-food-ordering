import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'
import { rest, findDishId } from '../fixtures/db.js'

const storesTab = (page) => page.locator('nav[aria-label="Student sections"] button[aria-label="Stores"]')

test.describe('error states', () => {
  test('a sold-out dish cannot be added to the cart', async ({ page }) => {
    const dishId = await findDishId()
    expect(dishId, 'E2E Test Dish must exist — run global-setup first').toBeTruthy()

    await rest(`menu_items?id=eq.${dishId}`, { method: 'PATCH', body: { available: false } })
    try {
      await signIn(page, ACCOUNTS.student)
      await storesTab(page).click()
      await page.getByRole('button', { name: /E2E Test Kitchen/ }).click()

      const dish = page.locator('button.menu-item').filter({ hasText: /E2E Test Dish/ }).first()
      await expect(dish).toBeVisible()
      await expect(dish).toBeDisabled()
      await expect(page.getByText(/Sold out/i).first()).toBeVisible()
    } finally {
      await rest(`menu_items?id=eq.${dishId}`, { method: 'PATCH', body: { available: true } })
    }
  })

  test('a search with no matches explains the empty result', async ({ page }) => {
    await signIn(page, ACCOUNTS.student)
    await storesTab(page).click()

    await page.locator('input[type="search"]').first().fill('zzzz-no-such-store')
    await expect(page.getByText(/No stores match/i).first()).toBeVisible()
  })
})
