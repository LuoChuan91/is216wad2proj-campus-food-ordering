<script setup>
import { ref } from 'vue'
import * as auth from '@/services/authService.js'

const name = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const sent = ref(false)
const busy = ref(false)

async function signUp() {
  error.value = ''
  if (!auth.isSmuEmail(email.value)) {
    error.value = 'Please use your SMU email address.'
    return
  }
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
    await auth.signUp({ email: email.value, password: password.value, name: name.value.trim() })
    sent.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 420px">
    <h1 class="h3 mb-3">Create account</h1>

    <div v-if="sent" class="alert alert-success">
      Account created. Check your email to confirm it. An admin must approve your account before you can order.
      <div class="mt-2"><RouterLink to="/login">Go to sign in</RouterLink></div>
    </div>

    <form v-else @submit.prevent="signUp">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div class="mb-3">
        <label class="form-label">Full name</label>
        <input v-model="name" class="form-control" required />
      </div>
      <div class="mb-3">
        <label class="form-label">SMU email</label>
        <input v-model="email" type="email" class="form-control" required />
      </div>
      <div class="mb-3">
        <label class="form-label">Password</label>
        <input v-model="password" type="password" class="form-control" required />
      </div>
      <div class="mb-3">
        <label class="form-label">Confirm password</label>
        <input v-model="confirm" type="password" class="form-control" required />
      </div>
      <button class="btn btn-primary w-100" :disabled="busy">
        {{ busy ? 'Creating...' : 'Create account' }}
      </button>
    </form>

    <div class="mt-3 small"><RouterLink to="/login">Already have an account? Sign in</RouterLink></div>
  </div>
</template>