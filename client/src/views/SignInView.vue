<script setup>
// Sign-in page. Sign-in is simulated for now: pick an account from the database.
// Supabase Auth (SMU email + password) replaces this later.
//
// Migrated from components/SignIn.vue. Rendered by the '/' route. Behaviour unchanged.
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useSessionStore } from '@/stores/session.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'

const ui = useUiStore()
const catalog = useCatalogStore()
const session = useSessionStore()
const { now } = storeToRefs(ui)

const showAll = ref(false)
const ORDER = { active: 0, inactive: 1, blocked: 2, removed: 3 }

function blurb(p) {
  if (p.role === 'merchant') {
    const st = catalog.storesOf(p.id)
    if (!st.length) return p.email
    const v = catalog.venue(st[0].venue_id)
    return st.length === 1 ? `${st[0].name} · ${v ? v.name : ''}` : `${st.length} stores: ${st.map((s) => s.name).join(', ')}`
  }
  if (p.role === 'admin') return 'Campus dining office'
  return p.email
}
function badge(p) {
  if (p.status === 'inactive') return { text: 'Waiting for approval', tone: 'warn' }
  if (p.status === 'blocked') return { text: 'Blocked', tone: 'muted' }
  if (p.status === 'removed') return { text: 'Removed', tone: 'muted' }
  return null
}

const groups = computed(() => {
  const students = catalog.db.profiles.filter((p) => p.role === 'student')
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name))
  const shown = showAll.value ? students : students.filter((p, i) => p.status === 'active' || i < 4)
  const pick = (role) => catalog.db.profiles.filter((p) => p.role === role)
  return [
    { title: 'Students', note: 'Order food, track it live, deliver for others', people: shown, more: students.length - shown.length },
    { title: 'Merchants', note: 'Run the kitchen order board and menu', people: pick('merchant'), more: 0 },
    { title: 'Admin', note: 'Approve students, add venues', people: pick('admin'), more: 0 },
  ].map((g) => ({ ...g, people: g.people.map((p) => ({ p, blurb: blurb(p), badge: badge(p) })) }))
})
</script>

<template>
  <div class="signin">
    <div class="si-wrap">
      <section class="si-hero">
        <div class="si-brand"><AppMark :size="52" /><div><h1>{{ cfg.appName }}</h1><p>{{ cfg.tagline }}</p></div></div>
        <p class="si-lead">Order from SMU food stores, skip the queue, or bring a classmate's lunch over between lessons and keep the delivery fee.</p>
        <ul class="si-points">
          <li><span><Icon name="map" :size="18" /></span>Find food on the campus map, with walking times and live waits</li>
          <li><span><Icon name="clock" :size="18" /></span>Honest ready times, worked out from each kitchen's queue</li>
          <li><span><Icon name="bike" :size="18" /></span>Peer delivery by verified SMU students</li>
        </ul>
        <div class="si-note"><Icon name="sparkle" :size="18" /><div><strong>Sign-in is simulated for now.</strong> Pick any account from our database. Payments are simulated too. Open a second tab and sign in as someone else to watch an order move between them live.</div></div>
      </section>
      <section class="si-card">
        <h2>Sign in</h2>
        <p class="si-sub">Pick an account.</p>
        <div v-for="g in groups" :key="g.title" class="si-group">
          <h3>{{ g.title }} <small>{{ g.note }}</small></h3>
          <button v-for="x in g.people" :key="x.p.id" type="button" class="si-acct" @click="session.signIn(x.p.id)">
            <Avatar :name="x.p.name" :size="38" :tone="x.p.role === 'student' ? 'brand' : 'navy'" />
            <span class="si-who"><strong>{{ x.p.name }}</strong><small>{{ x.blurb }}</small></span>
            <span v-if="x.badge" class="tag" :class="x.badge.tone">{{ x.badge.text }}</span>
            <Icon name="chevR" :size="16" class="si-go" />
          </button>
          <button v-if="g.more" type="button" class="si-toggle" @click="showAll = true"><Icon name="plus" :size="16" />Show {{ g.more }} more students</button>
        </div>
      </section>
    </div>
    <footer class="si-foot">
      <span><Icon name="clock" :size="13" />{{ E.dateLabel(now) }}, {{ E.clock(now) }} in Singapore</span>
    </footer>
  </div>
</template>


<style scoped>
/* Sign-in page (moved from the global prototype stylesheet). */
.signin {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    180deg,
    var(--navy) 0,
    var(--navy) 300px,
    var(--canvas) 300px
  );
}
.si-wrap {
  flex: 1;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 56px 24px 24px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 470px);
  gap: 48px;
  align-items: start;
}
.si-hero {
  color: #fff;
  padding-top: 8px;
}
.si-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 26px;
}
.si-brand h1 {
  font-family: var(--font-display);
  font-size: 46px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  margin: 0 0 6px;
  color: #fff;
}
.si-brand p {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #dfe4f7;
}
.si-lead {
  font-size: 17px;
  line-height: 1.55;
  color: #dfe4f7;
  max-width: 470px;
  margin: 0 0 30px;
}
.si-points {
  list-style: none;
  padding: 0;
  margin: 0 0 28px;
  display: grid;
  gap: 12px;
  color: var(--ink);
  max-width: 470px;
}
.si-points li {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px 14px;
  font-weight: 600;
  font-size: 14.5px;
}
.si-points li > span {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--brand-soft);
  color: var(--brand);
  flex: none;
}
.si-note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  max-width: 470px;
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.5;
  background: var(--warn-soft);
  border-radius: 14px;
  padding: 12px 14px;
}
.si-note .ic {
  color: var(--warn);
  margin-top: 2px;
}
.si-note strong {
  color: var(--ink);
}
.si-card {
  background: var(--paper);
  border-radius: 24px;
  padding: 26px 24px 20px;
  box-shadow:
    0 24px 60px rgba(20, 24, 40, 0.18),
    0 0 0 1px rgba(20, 24, 40, 0.04);
}
.si-card h2 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.01em;
}
.si-sub {
  color: var(--muted);
  margin: 2px 0 12px;
}
.si-group {
  margin-top: 14px;
}
.si-group h3 {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-2);
  margin: 0 4px 6px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}
.si-group h3 small {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 600;
  color: var(--muted);
  font-size: 12px;
  text-align: right;
}
.si-acct {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: 16px;
  padding: 10px 12px;
  margin-bottom: 6px;
  color: var(--ink);
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.si-acct:hover {
  border-color: #f0b3a3;
  background: #fffaf8;
}
.si-acct:focus-visible {
  outline: 3px solid rgba(229, 81, 45, 0.45);
  outline-offset: 1px;
}
.si-who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.si-who strong {
  font-size: 14.5px;
}
.si-who small {
  color: var(--muted);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.si-go {
  color: var(--muted);
}
.si-signup {
  margin-top: 16px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.si-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  color: var(--brand-600);
  font-weight: 700;
  padding: 4px;
  cursor: pointer;
}
.si-signup form {
  display: grid;
  gap: 10px;
  margin-top: 8px;
}
.si-signup label {
  display: grid;
  gap: 4px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
}
.si-signup .form-control {
  font-size: 14.5px;
  border-radius: 12px;
  padding: 9px 12px;
}
.si-signup .form-control:focus {
  border-color: #f2a48f;
  box-shadow: 0 0 0 0.2rem rgba(229, 81, 45, 0.18);
}
.si-signup .btn {
  font-weight: 700;
  border-radius: 12px;
  padding: 10px;
  --bs-btn-bg: var(--brand);
  --bs-btn-border-color: var(--brand);
  --bs-btn-hover-bg: var(--brand-600);
  --bs-btn-hover-border-color: var(--brand-600);
  --bs-btn-active-bg: var(--brand-600);
}
.si-signup small {
  color: var(--muted);
  font-size: 12px;
}
.si-foot {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding: 10px 24px 22px;
  color: var(--muted);
  font-size: 12.5px;
}
.si-foot span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.linkish {
  border: 0;
  background: none;
  padding: 0;
  color: var(--ink-2);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.linkish:hover {
  color: var(--brand-600);
}
.si-group .si-toggle {
  margin: 0 0 4px;
}
</style>
