// Signs in through the real UI (no shortcuts), so every test exercises the
// same path a student would.
//
// The sign-in page renders a desktop and a mobile copy of the form; only one is
// visible at a time, so every locator is scoped to the visible one.
export const visible = (locator) => locator.filter({ visible: true }).first()

export async function signIn(page, account) {
  await page.goto('/')
  await visible(page.getByLabel('SMU email')).fill(account.email)
  await visible(page.getByLabel('Password', { exact: true })).fill(account.password)
  await visible(page.getByRole('button', { name: 'Sign in', exact: true })).click()
}
