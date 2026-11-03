import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'

test.describe('sign in', () => {
  test('a student lands on the student portal', async ({ page }) => {
    await signIn(page, ACCOUNTS.student)
    await expect(page).toHaveURL(/\/student(\/|$)/, { timeout: 20000 })
  })

  test('a merchant lands on the merchant portal', async ({ page }) => {
    await signIn(page, ACCOUNTS.merchant)
    await expect(page).toHaveURL(/\/merchant(\/|$)/, { timeout: 20000 })
  })

  test('an admin lands on the admin portal', async ({ page }) => {
    await signIn(page, ACCOUNTS.admin)
    await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 20000 })
  })

  test('a wrong password shows an error and stays on the sign-in page', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('SMU email').fill(ACCOUNTS.student.email)
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page.getByRole('alert')).toContainText(/wrong|invalid/i, { timeout: 15000 })
    await expect(page).not.toHaveURL(/\/student/)
  })

  test('sign-up rejects a non-SMU email', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: 'Create account' }).click()

    await page.getByLabel('Full name').fill('Test Person')
    await page.getByLabel('SMU email').fill('someone@gmail.com')
    await page.getByLabel('Password', { exact: true }).fill('Abcd1234!')
    await page.getByLabel('Confirm password').fill('Abcd1234!')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByRole('alert')).toContainText(/SMU email/i)
  })
})
