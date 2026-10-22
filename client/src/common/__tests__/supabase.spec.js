import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The module reads import.meta.env at load time and calls createClient, so we
// mock the SDK and reset module state between cases.
const createClient = vi.fn(() => ({ __client: true }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

describe('browser supabase client', () => {
  beforeEach(() => {
    vi.resetModules()
    createClient.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exports null (no throw) when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const mod = await import('../supabase.js')
    expect(mod.default).toBeNull()
    expect(mod.supabase).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('constructs a client from env vars', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    const mod = await import('../supabase.js')
    expect(createClient).toHaveBeenCalledWith('https://demo.supabase.co', 'anon-key')
    expect(mod.supabase).toEqual({ __client: true })
  })
})
