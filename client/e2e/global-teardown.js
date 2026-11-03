// Cleans up everything the E2E suite created, after the run:
//   - orders (+ their items, payments and deliveries) placed by the test student
//   - the test dish, menu category, store and venue
//   - the three E2E accounts (profile + Supabase auth user)
//
// Safe to run when some of it is already gone: every step ignores missing rows.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACCOUNTS } from './accounts.js'

const here = path.dirname(fileURLToPath(import.meta.url))

const VENUE_NAME = 'E2E Test Venue'
const STORE_NAME = 'E2E Test Kitchen'
const CATEGORY_NAME = 'Mains'
const DISH_NAME = 'E2E Test Dish'

function readServerEnv() {
  const file = path.resolve(here, '../../server/.env')
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const inList = (ids) => `in.(${ids.join(',')})`

export default async function globalTeardown() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = readServerEnv()
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return

  const auth = { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` }
  const rest = (p) => `${SUPABASE_URL}/rest/v1/${p}`
  const get = async (p) => (await fetch(rest(p), { headers: auth })).json()
  const del = async (p) => fetch(rest(p), { method: 'DELETE', headers: { ...auth, Prefer: 'return=minimal' } })

  // 1. Who are the E2E users?
  const emails = Object.values(ACCOUNTS).map((a) => a.email)
  const profiles = await get(`profiles?select=id,email&email=${inList(emails.map(encodeURIComponent))}`)
  const userIds = (profiles || []).map((p) => p.id)

  // 2. Delete their orders and everything hanging off them
  if (userIds.length) {
    const orders = await get(`orders?select=id&student_id=${inList(userIds)}`)
    const orderIds = (orders || []).map((o) => o.id)

    if (orderIds.length) {
      await del(`deliveries?order_id=${inList(orderIds)}`)
      await del(`order_items?order_id=${inList(orderIds)}`)
      await del(`payments?order_id=${inList(orderIds)}`)
      await del(`orders?id=${inList(orderIds)}`)
    }

    // safety: any delivery they were courier for
    await del(`deliveries?courier_id=${inList(userIds)}`)
  }

  // 3. Delete the test catalog (order matters: dish -> category -> store -> venue)
  await del(`menu_items?name=eq.${encodeURIComponent(DISH_NAME)}`)
  const store = (await get(`stores?select=id&name=eq.${encodeURIComponent(STORE_NAME)}`))[0]
  if (store) await del(`menu_category?store_id=eq.${store.id}&name=eq.${encodeURIComponent(CATEGORY_NAME)}`)
  await del(`stores?name=eq.${encodeURIComponent(STORE_NAME)}`)
  await del(`venues?name=eq.${encodeURIComponent(VENUE_NAME)}`)

  // 4. Delete the profiles, then the auth users
  if (userIds.length) await del(`profiles?id=${inList(userIds)}`)

  const listed = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: auth })).json()
  for (const user of listed.users || []) {
    if (emails.includes(user.email.toLowerCase())) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: auth })
    }
  }
}
