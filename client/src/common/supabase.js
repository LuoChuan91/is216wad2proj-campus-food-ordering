// One shared browser Supabase client for the Vue app.
//
// This uses the ANON (publishable) key, NOT the secret key. The anon key is
// safe to ship to the browser because every request still goes through
// Row-Level Security. Never put the secret key (sb_secret_...) in the client.
//
// We only use this client for Supabase Realtime (broadcast channels) to learn
// *when* a store's queue changes. The actual queue data is fetched from our
// Express API (which uses the secret key and can read every order), so no other
// student's order data is ever exposed to the browser.
//
// Configure these in client/.env (see client/.env.example):
//   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY=sb_publishable_...   (or the legacy anon JWT)
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url, anonKey)

export default supabase
