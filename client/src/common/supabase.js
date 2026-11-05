// One shared browser Supabase client. 
// Uses the ANON key, and exports null (no throw) when env vars are missing.
//
// Configure these in client/.env:
//   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY=sb_publishable_...  
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
let supabase = null

if (url && anonKey) {
  supabase = createClient(url, anonKey)
} else {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — realtime disabled, falling back to polling.'
  )
}

export { supabase }

export default supabase
