<script setup>
import { ref } from 'vue'
import * as auth from '@/services/authService.js'

const email = ref('')
const error = ref('')
const sent = ref(false)
const busy = ref(false)

async function sendLink() {
  error.value = ''
  busy.value = true
  try {
    await auth.sendResetEmail(email.value)
    // Same message whether or not the account exists, so nobody can probe for accounts
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
    <h1 class="h3 mb-3">Forgot password</h1>

    <div v-if="sent" class="alert alert-success">
      If an account exists for that email, a reset link is on its way.
    </div>

    <form v-else @submit.prevent="sendLink">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div class="mb-3">
        <label class="form-label">SMU email</label>
        <input v-model="email" type="email" class="form-control" required />
      </div>
      <button class="btn btn-primary w-100" :disabled="busy">
        {{ busy ? 'Sending...' : 'Send reset link' }}
      </button>
    </form>

    <div class="mt-3 small"><RouterLink to="/login">Back to sign in</RouterLink></div>
  </div>
</template>