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
const errorKey = ref(0) // changing this replays the shake animation
const notice = ref('')
const busy = ref(false)

const tabs = [
  { key: 'login', label: 'Sign in' },
  { key: 'signup', label: 'Create account' },
  { key: 'forgot', label: 'Forgot password' },
]
const buttonLabels = { login: 'Sign in', signup: 'Create account', forgot: 'Send reset link' }
const buttonText = computed(() => (busy.value ? 'Please wait' : buttonLabels[mode.value]))

function switchTo(m) {
  mode.value = m
  error.value = ''
  notice.value = ''
}

function fail(message) {
  error.value = message
  errorKey.value++
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
    fail(e.message === 'Invalid login credentials' ? 'Email or password is wrong.' : e.message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="auth-panel mt-1">
    <div class="auth-tabs d-flex gap-1 mb-3" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        role="tab"
        class="auth-tab btn border-0 fw-bold px-3 py-2"
        :class="{ on: mode === t.key }"
        :aria-selected="mode === t.key"
        @click="switchTo(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <div
      v-if="notice"
      class="auth-alert ok d-flex align-items-start gap-2 rounded-3 px-3 py-2 mb-3"
      role="status"
    >
      <Icon name="sparkle" :size="16" />
      <span>{{ notice }}</span>
    </div>
    <div
      v-if="error"
      :key="errorKey"
      class="auth-alert bad rounded-3 px-3 py-2 mb-3"
      role="alert"
    >
      {{ error }}
    </div>

    <Transition name="swap" mode="out-in">
      <form :key="mode" class="auth-form d-grid gap-3" @submit.prevent="submit">
        <label v-if="mode === 'signup'" class="d-grid gap-1">
          <span>Full name</span>
          <input v-model="name" class="auth-input form-control" autocomplete="name" required />
        </label>

        <label class="d-grid gap-1">
          <span>SMU email</span>
          <input
            v-model="email"
            type="email"
            class="auth-input form-control"
            autocomplete="email"
            placeholder="you@smu.edu.sg"
            required
          />
        </label>

        <label v-if="mode !== 'forgot'" class="d-grid gap-1">
          <span>Password</span>
          <input
            v-model="password"
            type="password"
            class="auth-input form-control"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            required
          />
        </label>

        <label v-if="mode === 'signup'" class="d-grid gap-1">
          <span>Confirm password</span>
          <input v-model="confirm" type="password" class="auth-input form-control" autocomplete="new-password" required />
        </label>

        <button
          class="auth-submit btn w-100 d-flex align-items-center justify-content-center gap-2"
          :disabled="busy"
        >
          <span v-if="busy" class="auth-spin" aria-hidden="true"></span>
          {{ buttonText }}
        </button>
      </form>
    </Transition>

    <button
      v-if="mode === 'login'"
      type="button"
      class="auth-link btn border-0 d-block mx-auto mt-3 p-0 fw-bold"
      @click="switchTo('forgot')"
    >
      Forgot password?
    </button>
  </div>
</template>

<style scoped>
/* Layout/spacing (margins, padding, gaps, flex, grid, widths) now come from
   Bootstrap utility classes in the template. This block keeps only the custom
   theming Bootstrap can't express, and the few overrides needed so Bootstrap's
   .btn / .form-control defaults don't fight the app's look. */

/* Tabs with an animated underline */
.auth-tabs {
  border-bottom: 1px solid var(--line);
}
.auth-tab {
  position: relative;
  background: none;
  font-size: var(--fs-body);
  color: var(--muted);
  border-radius: 0;
  transition: color 0.2s ease;
}
.auth-tab:hover {
  color: var(--ink-2);
}
.auth-tab.on {
  color: var(--ink);
}
.auth-tab::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -1px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(90deg, var(--brand), #ffb347);
  transform: scaleX(0);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.auth-tab.on::after {
  transform: scaleX(1);
}
.auth-tab:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
  border-radius: 8px;
}

/* Alerts */
.auth-alert {
  font-size: 13.5px;
  line-height: 1.4;
  animation: alert-in 0.3s ease both;
}
.auth-alert.ok {
  background: var(--ok-soft);
  color: var(--ok);
}
.auth-alert.bad {
  background: var(--late-soft);
  color: var(--late);
  animation: alert-in 0.3s ease both, shake 0.45s 0.25s ease;
}

/* Form field labels */
.auth-form label {
  font-size: var(--fs-desc);
  font-weight: 700;
  color: var(--ink-2);
  transition: color 0.2s ease;
}
.auth-form label:focus-within {
  color: var(--brand-600);
}

/* Inputs — override Bootstrap .form-control to keep the rounded, soft look */
.auth-input.form-control {
  border: 1.5px solid var(--line);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 14.5px;
  color: var(--ink);
  background: #fbfcfe;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}
.auth-input.form-control::placeholder {
  color: #aab0bf;
}
.auth-input.form-control:hover {
  border-color: #cfd4e2;
}
.auth-input.form-control:focus {
  outline: none;
  border-color: var(--brand);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(229, 81, 45, 0.16);
}

/* Submit button — override Bootstrap .btn with the brand gradient */
.auth-submit.btn {
  position: relative;
  overflow: hidden;
  border: 0;
  border-radius: 12px;
  padding: 12px;
  margin-top: 6px;
  font-weight: 800;
  font-size: 15px;
  color: #fff;
  background: linear-gradient(135deg, var(--brand), #ff7a4d);
  box-shadow: 0 10px 22px rgba(229, 81, 45, 0.32);
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}
/* A light sheen that sweeps across on hover */
.auth-submit.btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 50%;
  height: 100%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  transform: skewX(-20deg);
  transition: left 0.6s ease;
}
.auth-submit.btn:hover:not(:disabled) {
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(229, 81, 45, 0.4);
}
.auth-submit.btn:hover:not(:disabled)::after {
  left: 120%;
}
.auth-submit.btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}
.auth-submit.btn:disabled {
  opacity: 0.75;
  cursor: wait;
}
.auth-spin {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}

.auth-link.btn {
  background: none;
  color: var(--brand-600);
  font-size: var(--fs-desc);
}
.auth-link.btn:hover {
  color: var(--brand-600);
  text-decoration: underline;
}

/* Switching between sign in, create account and forgot password */
.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.swap-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.swap-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes alert-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: none; }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(3px); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .auth-alert,
  .auth-alert.bad,
  .auth-spin {
    animation: none;
  }
  .auth-tab::after,
  .auth-submit.btn::after,
  .auth-input.form-control,
  .auth-submit.btn {
    transition: none;
  }
}
</style>