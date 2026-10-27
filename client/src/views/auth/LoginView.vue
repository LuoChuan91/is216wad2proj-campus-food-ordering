<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session.js'
import { useCatalogStore } from '@/stores/catalog.js'
import * as auth from '@/services/authService.js'

const router = useRouter()
const session = useSessionStore()
const catalog = useCatalogStore()

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function login() {
  error.value = ''
  busy.value = true
  try {
    const user = await auth.signIn(email.value, password.value)
    // Assumes profiles.id is the same as the Supabase auth user id
    const profile = catalog.user(user.id)
    if (!profile) throw new Error('No account record found for this login.')

    if (profile.status === 'blocked' || profile.status === 'removed') {
      await auth.signOut()
      throw new Error('This account cannot sign in.')
    }

    // Invited accounts must choose their own password first
    if (profile.password_set === false) {
      session.signIn(profile.id, { navigate: false })
      router.push('/reset-password')
      return
    }

    session.signIn(profile.id)
  } catch (e) {
    error.value = e.message === 'Invalid login credentials' ? 'Email or password is wrong.' : e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 420px">
    <h1 class="h3 mb-3">Sign in</h1>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <form @submit.prevent="login">
      <div class="mb-3">
        <label class="form-label">SMU email</label>
        <input v-model="email" type="email" class="form-control" required />
      </div>
      <div class="mb-3">
        <label class="form-label">Password</label>
        <input v-model="password" type="password" class="form-control" required />
      </div>
      <button class="btn btn-primary w-100" :disabled="busy">
        {{ busy ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>

    <div class="d-flex justify-content-between mt-3 small">
      <RouterLink to="/forgot-password">Forgot password?</RouterLink>
      <RouterLink to="/signup">Create account</RouterLink>
    </div>
  </div>
</template>