// Prepares everything the E2E suite needs before the tests run:
//   1. three accounts (student, merchant, admin) with known passwords
//   2. a test venue, store, menu category and dish owned by the merchant
//
// Uses the Supabase Admin API + REST with the service key from server/.env.
// Every step is idempotent: run it as often as you like.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACCOUNTS } from './accounts.js'

const here = path.dirname(fileURLToPath(import.meta.url))

const VENUE = { name: 'E2E Test Venue', address: 'E2E', lat: 1.2966, lng: 103.8499, type: 'eatery' }
const STORE = { name: 'E2E Test Kitchen', description: 'Automated test store', is_open: true }
const CATEGORY = { name: 'Mains' }
const DISH = { name: 'E2E Test Dish', description: 'Automated test dish', price: 5, cook_time_sec: 300, max_at_once: 2, available: true, is_archived: false }
const HOURS = { mon: ['08:00', '22:00'], tue: ['08:00', '22:00'], wed: ['08:00', '22:00'], thu: ['08:00', '22:00'], fri: ['08:00', '22:00'], sat: ['08:00', '22:00'], sun: ['08:00', '22:00'] }

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

  const auth = { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` }
  const json = { ...auth, 'Content-Type': 'application/json' }
  const rest = (p) => `${SUPABASE_URL}/rest/v1/${p}`

  // --- accounts -------------------------------------------------------------
  const listed = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: auth })).json()
  const existing = new Map((listed.users || []).map((u) => [u.email.toLowerCase(), u]))
  const ids = {}

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

    ids[account.email] = user.id

    const profileRes = await fetch(rest('profiles'), {
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

  // --- test catalog ---------------------------------------------------------
  // Find by name, then update it; insert when missing.
  async function ensure(table, match, values) {
    const query = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&')
    const rows = await (await fetch(rest(`${table}?select=*&${query}`), { headers: auth })).json()
    if (Array.isArray(rows) && rows.length) {
      const res = await fetch(rest(`${table}?id=eq.${rows[0].id}`), {
        method: 'PATCH',
        headers: { ...json, Prefer: 'return=representation' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error(`update ${table}: ${res.status} ${await res.text()}`)
      return (await res.json())[0]
    }
    const res = await fetch(rest(table), {
      method: 'POST',
      headers: { ...json, Prefer: 'return=representation' },
      body: JSON.stringify({ ...match, ...values }),
    })
    if (!res.ok) throw new Error(`insert ${table}: ${res.status} ${await res.text()}`)
    return (await res.json())[0]
  }

  const venue = await ensure('venues', { name: VENUE.name }, VENUE)
  const store = await ensure('stores', { name: STORE.name }, {
    ...STORE,
    venue_id: venue.id,
    merchant_id: ids[ACCOUNTS.merchant.email],
    open_hours: HOURS,
  })
  const category = await ensure('menu_category', { name: CATEGORY.name, store_id: store.id }, { name: CATEGORY.name, store_id: store.id })
  await ensure('menu_items', { name: DISH.name, menu_category_id: category.id }, { ...DISH, menu_category_id: category.id })
}
