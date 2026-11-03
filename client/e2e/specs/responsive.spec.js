import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'

const VIEWPORTS = [
  { name: 'phone 390', width: 390, height: 844 },
  { name: 'tablet 768', width: 768, height: 1024 },
  { name: 'laptop 1440', width: 1440, height: 900 },
]

test('the store list fits every viewport without horizontal scrolling', async ({ page }) => {
  await signIn(page, ACCOUNTS.student)
  await page.locator('nav[aria-label="Student sections"] button[aria-label="Stores"]').click()
  await expect(page.getByRole('heading', { name: /All stores/i })).toBeVisible()

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.waitForTimeout(400)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${viewport.name}: page scrolls sideways`).toBeLessThanOrEqual(1)

    await expect(page.locator('button.store-card').first()).toBeVisible()
  }
})
