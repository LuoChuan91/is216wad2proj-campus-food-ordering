// Creates (or resets) the E2E accounts before the suite runs.
//
// Uses the Supabase Admin API with the service key from server/.env, so the
// tests never need to sign up through the UI. Each account gets a known
// password and an `active` profile, so it can reach its portal immediately.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACCOUNTS } from './accounts.js'

const here = path.dirname(fileURLToPath(import.meta.url))

function readServerEnv() {
  const file = path.resolve(here, '../../server/.env')
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

export default async function globalSetup() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = readServerEnv()
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('E2E setup needs SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env')
  }

  const headers = { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` }
  const json = { ...headers, 'Content-Type': 'application/json' }

  const listed = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers })).json()
  const existing = new Map((listed.users || []).map((u) => [u.email.toLowerCase(), u]))

  for (const account of Object.values(ACCOUNTS)) {
    let user = existing.get(account.email.toLowerCase())

    if (!user) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          email: account.email,
          password: account.password,
          email_confirm: true,
          user_metadata: { name: account.name },
        }),
      })
      if (!res.ok) throw new Error(`create ${account.email}: ${res.status} ${await res.text()}`)
      user = await res.json()
    } else {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
        method: 'PUT',
        headers: json,
        body: JSON.stringify({ password: account.password, email_confirm: true }),
      })
      if (!res.ok) throw new Error(`reset ${account.email}: ${res.status} ${await res.text()}`)
    }

    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...json, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        id: user.id,
        role: account.role,
        name: account.name,
        email: account.email,
        status: 'active',
        password_set: true,
        phone: '81234567',
      }),
    })
    if (!profileRes.ok) throw new Error(`profile ${account.email}: ${profileRes.status} ${await profileRes.text()}`)
  }
}
