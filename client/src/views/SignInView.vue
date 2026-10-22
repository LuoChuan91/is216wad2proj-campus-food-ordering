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
