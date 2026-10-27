<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session.js'
import { useCatalogStore } from '@/stores/catalog.js'
import * as auth from '@/services/authService.js'

const router = useRouter()
const session = useSessionStore()
const catalog = useCatalogStore()

const mode = ref('login') // 'login' | 'signup' | 'forgot'
const name = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const notice = ref('')
const busy = ref(false)

const tabs = [
  { key: 'login', label: 'Sign in' },
  { key: 'signup', label: 'Create account' },
  { key: 'forgot', label: 'Forgot password' },
]
const buttonLabels = { login: 'Sign in', signup: 'Create account', forgot: 'Send reset link' }
const buttonText = computed(() => (busy.value ? 'Please wait...' : buttonLabels[mode.value]))

function switchTo(m) {
  mode.value = m
  error.value = ''
  notice.value = ''
}

async function login() {
  const user = await auth.signIn(email.value, password.value)
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
}

async function signup() {
  if (!auth.isSmuEmail(email.value)) throw new Error('Please use your SMU email address.')
  if (password.value.length < 8) throw new Error('Password must be at least 8 characters.')
  if (password.value !== confirm.value) throw new Error('The two passwords do not match.')

  await auth.signUp({ email: email.value, password: password.value, name: name.value.trim() })
  password.value = ''
  confirm.value = ''
  mode.value = 'login'
  notice.value = 'Account created. Check your email to confirm it. An admin must approve it before you can order.'
}

async function forgot() {
  await auth.sendResetEmail(email.value)
  notice.value = 'If an account exists for that email, a reset link is on its way.'
}

const handlers = { login, signup, forgot }

async function submit() {
  error.value = ''
  notice.value = ''
  busy.value = true
  try {
    await handlers[mode.value]()
  } catch (e) {
    error.value = e.message === 'Invalid login credentials' ? 'Email or password is wrong.' : e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="auth-panel">
    <div class="auth-tabs" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="auth-tab"
        :class="{ on: mode === t.key }"
        @click="switchTo(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="notice" class="alert alert-success py-2 small">{{ notice }}</div>
    <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>

    <form class="auth-form" @submit.prevent="submit">
      <label v-if="mode === 'signup'">
        Full name
        <input v-model="name" class="form-control" required />
      </label>

      <label>
        SMU email
        <input v-model="email" type="email" class="form-control" required />
      </label>

      <label v-if="mode !== 'forgot'">
        Password
        <input v-model="password" type="password" class="form-control" required />
      </label>

      <label v-if="mode === 'signup'">
        Confirm password
        <input v-model="confirm" type="password" class="form-control" required />
      </label>

      <button class="auth-submit" :disabled="busy">{{ buttonText }}</button>
    </form>

    <button v-if="mode === 'login'" type="button" class="auth-link" @click="switchTo('forgot')">
      Forgot password?
    </button>
  </div>
</template>

<style scoped>
.auth-panel {
  margin-bottom: 8px;
}
.auth-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 14px;
}
.auth-tab {
  border: 0;
  background: none;
  padding: 8px 10px;
  font-weight: 700;
  font-size: 14px;
  color: var(--muted);
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
}
.auth-tab.on {
  color: var(--ink);
  border-bottom-color: var(--brand);
}
.auth-form {
  display: grid;
  gap: 10px;
}
.auth-form label {
  display: grid;
  gap: 4px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
}
.auth-form .form-control {
  font-size: 14.5px;
  border-radius: 12px;
  padding: 9px 12px;
}
.auth-form .form-control:focus {
  border-color: #f2a48f;
  box-shadow: 0 0 0 0.2rem rgba(229, 81, 45, 0.18);
}
.auth-submit {
  border: 0;
  border-radius: 12px;
  padding: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--brand);
  cursor: pointer;
  margin-top: 4px;
}
.auth-submit:hover:not(:disabled) {
  background: var(--brand-600);
}
.auth-submit:disabled {
  opacity: 0.7;
  cursor: wait;
}
.auth-link {
  border: 0;
  background: none;
  padding: 6px 0 0;
  color: var(--brand-600);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
</style>