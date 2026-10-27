<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/common/supabase.js'
import * as auth from '@/services/authService.js'

const router = useRouter()
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
    <h1 class="h3 mb-3">Set new password</h1>

    <div v-if="!ready && !done" class="alert alert-warning">
      This reset link is invalid or has expired.
      <div class="mt-2"><RouterLink to="/forgot-password">Request a new one</RouterLink></div>
    </div>

    <div v-else-if="done" class="alert alert-success">
      Password saved.
      <button class="btn btn-sm btn-primary ms-2" @click="router.push('/login')">Go to sign in</button>
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
  </div>
</template>