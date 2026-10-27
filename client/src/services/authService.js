// All Supabase Auth calls live here so the pages stay simple.
import { supabase } from '@/common/supabase.js'

function client() {
  if (!supabase) {
    throw new Error('Sign-in is not set up. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to client/.env, then restart pnpm dev.')
  }
  return supabase
}

// Accepts name@smu.edu.sg and name@business.smu.edu.sg style addresses
const SMU_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)*smu\.edu\.sg$/i
export const isSmuEmail = (email) => SMU_EMAIL.test(email.trim())

export async function signUp({ email, password, name }) {
  const { data, error } = await client().auth.signUp({
    email: email.trim(),
    password,
    options: {
      // The handle_new_user trigger copies these into public.profiles
      data: { name, role: 'student', status: 'inactive', password_set: true },
    },
  })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  const { data, error } = await client().auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw error
  return data.user
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut()
}

export async function sendResetEmail(email) {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/#/reset-password`,
  })
  if (error) throw error
}

export async function setNewPassword(password) {
  const { error } = await client().auth.updateUser({ password })
  if (error) throw error
}