// One shared Supabase client for the whole server. Only repositories should import this.
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env and fill them in.');
}

// The secret key bypasses Row Level Security, so it must stay on the server.
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;
