// Direct database access for the E2E tests, using the service key from
// server/.env. Only used to arrange or inspect state that the UI cannot set
// directly (forcing a delivery to expire, toggling a dish to sold out).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

function readEnvFile(relative) {
  const file = path.resolve(here, relative)
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const serverEnv = readEnvFile('../../../server/.env')
const clientEnv = readEnvFile('../../../client/.env')

const base = `${serverEnv.SUPABASE_URL}/rest/v1/`
const headers = {
  apikey: serverEnv.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${serverEnv.SUPABASE_SECRET_KEY}`,
}

export async function rest(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: body
      ? { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' }
      : { ...headers, Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${pathname}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function findStoreId(name = 'E2E Test Kitchen') {
  const rows = await rest(`stores?select=id&name=eq.${encodeURIComponent(name)}`)
  return rows[0] && rows[0].id
}

export async function findDishId(name = 'E2E Test Dish') {
  const rows = await rest(`menu_items?select=id&name=eq.${encodeURIComponent(name)}`)
  return rows[0] && rows[0].id
}

// A real Supabase session token, so API calls work whether or not the server
// enforces authentication.
export async function signInToken(email, password) {
  const res = await fetch(`${clientEnv.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: clientEnv.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`sign in ${email}: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}
