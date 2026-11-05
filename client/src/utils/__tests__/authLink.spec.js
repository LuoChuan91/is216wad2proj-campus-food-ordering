import { describe, it, expect } from 'vitest'
import { linkParams } from '../authLink.js'

describe('linkParams', () => {
  it('reads the tokens Supabase adds after the route', () => {
    const p = linkParams('#/reset-password#access_token=AAA.BBB.CCC&expires_in=3600&refresh_token=rrr&token_type=bearer&type=recovery')
    expect(p.get('access_token')).toBe('AAA.BBB.CCC')
    expect(p.get('refresh_token')).toBe('rrr')
    expect(p.get('type')).toBe('recovery')
  })

  it('reads an error Supabase sends back for a used or expired link', () => {
    const p = linkParams('#/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    expect(p.get('error_code')).toBe('otp_expired')
    expect(p.get('access_token')).toBeNull()
  })

  it('is empty for a normal page address', () => {
    expect(linkParams('#/reset-password').toString()).toBe('')
    expect(linkParams('').toString()).toBe('')
    expect(linkParams(undefined).toString()).toBe('')
  })
})
