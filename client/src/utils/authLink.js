// Supabase email links (password reset) come back as
//   https://site/#/reset-password#access_token=…&refresh_token=…&type=recovery
// Because the app routes with "#/", supabase-js can't see those tokens (it reads
// everything after the FIRST "#"). This returns the part after the SECOND "#".
export function linkParams(hash) {
  const text = String(hash || '')
  const second = text.indexOf('#', 1)
  return new URLSearchParams(second > 0 ? text.slice(second + 1) : '')
}
