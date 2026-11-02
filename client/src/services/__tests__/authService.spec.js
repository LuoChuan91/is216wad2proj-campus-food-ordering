// Unit tests for services/authService.js.
//
// isSmuEmail is a pure domain-allowlist check (the main testable behaviour).
// The auth wrappers require a live Supabase client; we only assert that they
// throw the helpful "not set up" error when the shared client is null (the
// offline/misconfigured case the app is designed to surface).
import { describe, it, expect, vi } from 'vitest'

// Force the shared client to be null so client() throws its guidance error.
vi.mock('@/common/supabase.js', () => ({ supabase: null, default: null }))

import { isSmuEmail, signUp, signIn, sendResetEmail, setNewPassword, signOut } from '../authService.js'

describe('isSmuEmail', () => {
  it('accepts the allowed SMU domains', () => {
    expect(isSmuEmail('student@smu.edu.sg')).toBe(true)
    expect(isSmuEmail('dev@computing.smu.edu.sg')).toBe(true)
    expect(isSmuEmail('acc@accountancy.smu.edu.sg')).toBe(true)
    expect(isSmuEmail('biz@business.smu.edu.sg')).toBe(true)
  })

  it('is case- and whitespace-insensitive', () => {
    expect(isSmuEmail('  Student@SMU.edu.SG  ')).toBe(true)
  })

  it('rejects non-SMU and malformed addresses', () => {
    expect(isSmuEmail('someone@gmail.com')).toBe(false)
    expect(isSmuEmail('someone@notsmu.edu.sg')).toBe(false)
    expect(isSmuEmail('no-at-sign')).toBe(false)
    expect(isSmuEmail('@smu.edu.sg')).toBe(true) // domain only still matches the allowlist
  })
})

describe('auth wrappers without a configured client', () => {
  it('throw the "not set up" guidance when supabase is null', async () => {
    await expect(signUp({ email: 'a@smu.edu.sg', password: 'x', name: 'A' })).rejects.toThrow(/not set up/i)
    await expect(signIn('a@smu.edu.sg', 'x')).rejects.toThrow(/not set up/i)
    await expect(sendResetEmail('a@smu.edu.sg')).rejects.toThrow(/not set up/i)
    await expect(setNewPassword('x')).rejects.toThrow(/not set up/i)
  })

  it('signOut is a no-op (does not throw) when there is no client', async () => {
    await expect(signOut()).resolves.toBeUndefined()
  })
})
