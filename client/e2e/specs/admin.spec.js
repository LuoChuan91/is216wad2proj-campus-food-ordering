import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'

test.describe('admin', () => {
  test('the approvals screen lists student accounts', async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await expect(page).toHaveURL(/\/admin/)

    // The approvals body always renders one of these two blocks
    await expect(
      page.getByText(/Active \/ Inactive students|Nobody is waiting/i).first(),
    ).toBeVisible({ timeout: 20000 })
  })
})
