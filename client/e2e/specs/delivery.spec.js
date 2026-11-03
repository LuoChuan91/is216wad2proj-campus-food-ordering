import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'
import { placeE2EDeliveryOrder, BASE_URL } from '../fixtures/order.js'

test('a peer delivery is accepted, picked up and delivered', async ({ page, browser }) => {
  // 1. Student orders with peer delivery
  const studentContext = await browser.newContext({ baseURL: BASE_URL })
  const student = await studentContext.newPage()
  await signIn(student, ACCOUNTS.student)
  const code = await placeE2EDeliveryOrder(student)

  await expect(
    student.getByText(/Finding a student courier|Switches to pickup/i).first(),
  ).toBeVisible({ timeout: 20000 })

  // 2. Merchant marks it ready (the courier can only collect ready food)
  const merchantContext = await browser.newContext({ baseURL: BASE_URL })
  const merchant = await merchantContext.newPage()
  await signIn(merchant, ACCOUNTS.merchant)

  const card = merchant.locator('.ocard').filter({ hasText: `#${code}` }).first()
  await expect(card).toBeVisible({ timeout: 25000 })
  await card.getByRole('button', { name: /Start cooking/i }).click()
  await expect(card.getByRole('button', { name: /Mark ready/i })).toBeVisible({ timeout: 20000 })
  await card.getByRole('button', { name: /Mark ready/i }).click()

  // 3. A different student (the courier) accepts and delivers
  await signIn(page, ACCOUNTS.courier)
  await page.locator('nav[aria-label="Student sections"] button[aria-label="Deliver"]').click()

  const available = page.getByRole('switch')
  if (!(await available.isChecked())) await available.check()

  // The open-job card shows the store, not the order code
  const job = page.locator('.job').filter({ hasText: /E2E Test Kitchen/ }).first()
  await expect(job).toBeVisible({ timeout: 25000 })
  await job.getByRole('button', { name: /Accept job/i }).click()

  const active = page.locator('.job.active-job').filter({ hasText: `#${code}` }).first()
  await expect(active).toBeVisible({ timeout: 20000 })
  await active.getByRole('button', { name: /Picked up the food/i }).click()
  await expect(active.getByRole('button', { name: /Mark as delivered/i })).toBeVisible({ timeout: 20000 })
  await active.getByRole('button', { name: /Mark as delivered/i }).click()

  // 4. The student sees it delivered
  await expect(student.getByText(/Delivered|Enjoy your meal/i).first()).toBeVisible({ timeout: 30000 })

  await studentContext.close()
  await merchantContext.close()
})
