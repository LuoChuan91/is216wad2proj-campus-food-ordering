<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/common/supabase.js'
import * as auth from '@/services/authService.js'
import { api } from '@/services/api.js'
import { useSessionStore } from '@/stores/session.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { HOME } from '@/router/nav.js'
import { config as cfg } from '@/config/index.js'

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

function signOutAndLeave() {
  auth.signOut()
  session.signOut()
}
</script>

<template>
  <div class="reset">
    <span class="blob b1" aria-hidden="true"></span>
    <span class="blob b2" aria-hidden="true"></span>

    <section class="reset-card">
      <div class="brand">
        <AppMark :size="40" />
        <span>{{ cfg.appName }}</span>
      </div>

      <!-- Link is invalid or expired -->
      <template v-if="!ready && !done">
        <h1>Link expired</h1>
        <div class="alert" role="alert">
          This reset link is invalid or has expired.
        </div>
        <RouterLink to="/" class="submit link-btn">Request a new one</RouterLink>
      </template>

      <!-- Password saved -->
      <template v-else-if="done">
        <div class="ok" role="status">
          <h1>Password saved</h1>
          <p class="sub">You can now sign in with your new password.</p>
          <button v-if="me" class="submit" @click="router.push(HOME[me.role] || '/')">Continue</button>
          <button v-else class="submit" @click="router.push('/')">Go to sign in</button>
        </div>
      </template>

      <!-- Set password form -->
      <template v-else>
        <h1>{{ invited ? 'Choose your password' : 'Set new password' }}</h1>
        <p v-if="invited" class="sub">
          Welcome, {{ me.name }}. Your account was set up with a temporary password. Choose your own to continue.
        </p>
        <p v-else class="sub">Choose a new password for your account.</p>

        <div v-if="error" class="alert" role="alert">{{ error }}</div>

        <form @submit.prevent="save" class="form">
          <label>
            <span>New password</span>
            <input v-model="password" type="password" autocomplete="new-password" required />
          </label>

          <label>
            <span>Confirm new password</span>
            <input v-model="confirm" type="password" autocomplete="new-password" required />
          </label>

          <button class="submit" :disabled="busy">
            <span v-if="busy" class="spin" aria-hidden="true"></span>
            {{ busy ? 'Saving...' : 'Save password' }}
          </button>
        </form>

        <button v-if="invited" type="button" class="signout" @click="signOutAndLeave">
          Sign out
        </button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.reset {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background: var(--navy);
  color: #fff;
  overflow: hidden;
}
/* Soft glowing blobs, same as the sign-in page */
.blob {
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.45;
  pointer-events: none;
  animation: drift 16s ease-in-out infinite alternate;
}
.b1 {
  width: 420px;
  height: 420px;
  top: -140px;
  left: -120px;
  background: #3b5bdb;
}
.b2 {
  width: 360px;
  height: 360px;
  bottom: -120px;
  right: -100px;
  background: var(--brand);
  animation-delay: -8s;
}

.reset-card {
  width: 100%;
  max-width: 420px;
  background: var(--paper);
  color: var(--ink);
  border-radius: 24px;
  padding: 30px 26px 26px;
  box-shadow:
    0 24px 60px rgba(20, 24, 40, 0.28),
    0 0 0 1px rgba(20, 24, 40, 0.04);
  animation: rise 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--ink);
  margin-bottom: 22px;
}

h1 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0 0 6px;
}

.sub {
  color: var(--muted);
  font-size: var(--fs-desc);
  margin: 0 0 20px;
}

.alert {
  background: var(--late-soft);
  color: var(--late);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 16px;
  font-size: 13.5px;
  font-weight: 600;
  animation: shake 0.45s ease;
}

.form {
  display: grid;
  gap: 14px;
}

.form label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
}

.form input {
  width: 100%;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 14.5px;
  color: var(--ink);
  background: #fbfcfe;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}
.form input:hover {
  border-color: #cfd4e2;
}
.form input:focus {
  outline: none;
  border-color: var(--brand);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(229, 81, 45, 0.16);
}

.submit {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 6px;
  border: 0;
  border-radius: 12px;
  padding: 12px;
  font-weight: 800;
  font-size: 15px;
  color: #fff;
  text-decoration: none;
  background: linear-gradient(135deg, var(--brand), #ff7a4d);
  box-shadow: 0 10px 22px rgba(229, 81, 45, 0.32);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}
.submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(229, 81, 45, 0.4);
}
.submit:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}
.submit:disabled {
  opacity: 0.75;
  cursor: wait;
}

.signout {
  display: block;
  width: 100%;
  margin-top: 12px;
  border: 0;
  background: none;
  color: var(--brand-600);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.signout:hover {
  text-decoration: underline;
}

.spin {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}

.ok {
  animation: rise 0.4s ease both;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(16px); }
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
@keyframes drift {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(40px, 30px) scale(1.08); }
}

@media (prefers-reduced-motion: reduce) {
  .blob,
  .reset-card,
  .ok,
  .alert,
  .spin {
    animation: none;
  }
}
</style>
