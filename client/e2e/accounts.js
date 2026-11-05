// Accounts the end-to-end tests sign in with.
// global-setup.js creates (or resets) them in Supabase before the suite runs.
export const ACCOUNTS = {
  student: { email: 'e2e.student@smu.edu.sg', password: 'E2ePass123!', name: 'E2E Student', role: 'student' },
  courier: { email: 'e2e.courier@smu.edu.sg', password: 'E2ePass123!', name: 'E2E Courier', role: 'student' },
  merchant: { email: 'e2e.merchant@smu.edu.sg', password: 'E2ePass123!', name: 'E2E Merchant', role: 'merchant' },
  admin: { email: 'e2e.admin@smu.edu.sg', password: 'E2ePass123!', name: 'E2E Admin', role: 'admin' },
}
