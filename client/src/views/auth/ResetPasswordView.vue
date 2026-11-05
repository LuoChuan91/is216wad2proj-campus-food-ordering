<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/common/supabase.js'
import * as auth from '@/services/authService.js'
import { api } from '@/services/api.js'
import { useSessionStore } from '@/stores/session.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { HOME } from '@/router/nav.js'
import { linkParams } from '@/utils/authLink.js'

const router = useRouter()
const session = useSessionStore()
const catalog = useCatalogStore()
const me = computed(() => catalog.user(session.session.userId))
const invited = computed(() => !!me.value && me.value.password_set === false)
const password = ref('')
const confirm = ref('')
const error = ref('')
const ready = ref(false) // true once Supabase has a recovery session
const done = ref(false)
const busy = ref(false)
let subscription = null

onMounted(async () => {
  if (!supabase) {
    error.value = 'Sign-in is not set up yet.'
    return
  }
  const params = linkParams(window.location.hash)
  if (params.get('access_token') && params.get('refresh_token')) {
    await supabase.auth.setSession({
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
    })
  }
  // Don't leave the tokens (or an error) sitting in the address bar
  if (params.toString()) router.replace('/reset-password')

  const { data } = await supabase.auth.getSession()
  ready.value = !!data.session

  const res = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' || session) ready.value = true
  })
  subscription = res.data.subscription
})

onUnmounted(() => subscription?.unsubscribe())

async function save() {
  error.value = ''
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'The two passwords do not match.'
    return
  }

  busy.value = true
  try {
    await auth.setNewPassword(password.value)
    if (invited.value) {
      const saved = await api.markPasswordSet(me.value.id)
      Object.assign(me.value, saved)
      router.push(HOME[me.value.role] || '/')
      return
    }
    done.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 420px">
    <h1 class="h3 mb-3">{{ invited ? 'Choose your password' : 'Set new password' }}</h1>
    <p v-if="invited" class="text-body-secondary">Welcome, {{ me.name }}. Your account was set up with a temporary password. Choose your own to continue.</p>

    <div v-if="!ready && !done" class="alert alert-warning">
      This reset link is invalid or has expired.
      <div class="mt-2"><RouterLink to="/">Request a new one</RouterLink></div>
    </div>

    <div v-else-if="done" class="alert alert-success">
      Password saved.
      <button v-if="me" class="btn btn-sm btn-primary ms-2" @click="router.push(HOME[me.role] || '/')">Continue</button>
      <button v-else class="btn btn-sm btn-primary ms-2" @click="router.push('/')">Go to sign in</button>
    </div>

    <form v-else @submit.prevent="save">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div class="mb-3">
        <label class="form-label">New password</label>
        <input v-model="password" type="password" class="form-control" required />
      </div>
      <div class="mb-3">
        <label class="form-label">Confirm new password</label>
        <input v-model="confirm" type="password" class="form-control" required />
      </div>
      <button class="btn btn-primary w-100" :disabled="busy">
        {{ busy ? 'Saving...' : 'Save password' }}
      </button>
    </form>
    <button v-if="invited" type="button" class="btn btn-link w-100 mt-2" @click="auth.signOut(); session.signOut()">Sign out</button>
  </div>
</template>