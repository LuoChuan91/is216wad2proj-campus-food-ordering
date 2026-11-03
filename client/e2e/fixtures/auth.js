// Signs in through the real UI (no shortcuts), so every test exercises the
// same path a student would.
export async function signIn(page, account) {
  await page.goto('/')
  await page.getByLabel('SMU email').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}
