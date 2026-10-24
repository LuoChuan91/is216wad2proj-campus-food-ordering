<script setup>
// Live tracking of one order: ready time from the kitchen queue, the courier, and every step.
//
// Migrated from portals/student/TrackPage.vue. The order id now comes from the
// route param (:orderId) rather than S.ui.student.trackOrderId. The peer-delivery
// walking leg still comes from the campus map's model (utils/mapApi.js), unchanged.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { shortName } from '@/utils/landmarks.js'
import { estimateWalkingSeconds } from '@/utils/mapApi.js'
import { useStoreWait } from '@/composables/storeWaitCache.js'
import ReceiptPanel from '@/components/ReceiptPanel.vue'

const route = useRoute()
const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { now, busy } = storeToRefs(ui)

const first = (name) => (name || '').split(' ')[0]
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const orderId = computed(() => route.params.orderId)
const order = computed(() => orders.order(orderId.value))
const store = computed(() => (order.value ? catalog.store(order.value.store_id) : null))
const venue = computed(() => (store.value ? catalog.venue(store.value.venue_id) : null))
const venueName = computed(() => (venue.value ? shortName(venue.value.name) : ''))
const lines = computed(() => order.value.items)
const d = computed(() => order.value.delivery)
const drop = computed(() => d.value && catalog.dropoff(d.value.destination_id))

// Live wait for THIS order from the single frontend engine (store:<id> realtime).
// readyAt is derived on the frontend as now + seconds; `ahead` is the queue count.
const wait = useStoreWait(
  computed(() => (order.value ? order.value.store_id : null)),
  orderId,
)
const q = computed(() => {
  if (wait.entry.loading || !order.value) return null
  return { readyAt: now.value + wait.entry.seconds * 1000, ahead: wait.entry.ahead }
})
const pay = computed(() => order.value.payment)
const firstItem = computed(() => lines.value[0] && catalog.item(lines.value[0].menu_item_id))
const delivering = computed(() => !!d.value && !order.value.fallback)

// The walking leg for peer delivery, from the campus map's model (utils/mapApi.js):
// straight-line distance x 1.3, walking at 75 m/min.
const walkSeconds = computed(() => {
  if (!delivering.value) return 0
  const from = venue.value
  const to = drop.value
  if (!from || !to) return 0
  return estimateWalkingSeconds({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
})

const phase = computed(() => {
  const o = order.value, dl = d.value, s = store.value
  const cn = dl ? first(dl.courier_name) : ''
  if (o.status === 'paid') return { tone: 'info', title: 'In the queue' }
  if (o.status === 'preparing') return { tone: 'brand', title: 'Being prepared' }
  if (o.status === 'ready' && o.type === 'pickup') return { tone: 'ok', title: 'Ready for pickup', big: 'Collect now', sub: `At ${s.name}, ${venueName.value}${o.ready_at ? ' · ready since ' + E.clock(o.ready_at) : ''}` }
  if (o.status === 'ready' && dl && dl.status === 'picked_up') return { tone: 'brand', title: 'On the way', big: `${cn} is walking over`, sub: `To ${drop.value ? drop.value.name : 'you'}` }
  if (o.status === 'ready' && dl && dl.status === 'accepted') return { tone: 'ok', title: 'Ready', big: `${cn} is picking it up`, sub: `From ${s.name}, ${venueName.value}` }
  if (o.status === 'ready') return { tone: 'ok', title: 'Ready', big: 'Your food is ready', sub: 'Waiting for a student courier to accept the job' }
  if (o.status === 'completed' && dl) return { tone: 'ok', title: 'Delivered', big: 'Enjoy your meal', sub: `Dropped at ${drop.value ? drop.value.name : 'your drop-off point'}${dl.delivered_at ? ', ' + E.clock(dl.delivered_at) : ''}` }
  if (o.status === 'completed') return { tone: 'ok', title: 'Collected', big: 'Enjoy your meal', sub: o.completed_at ? `Collected at ${E.clock(o.completed_at)}` : '' }
  if (o.status === 'cancelled') return { tone: 'muted', title: 'Cancelled', big: 'Order cancelled', sub: '' }
  return { tone: 'muted', title: o.status, big: '', sub: '' }
})

// Each step is done once the order has got that far (some steps have no time saved in the database)
const RANK = { pending: 0, paid: 1, preparing: 2, ready: 3, completed: 4 }
const steps = computed(() => {
  const o = order.value, dl = delivering.value ? d.value : null
  const r = RANK[o.status] || 0
  const list = [
    { k: 'placed', label: 'Order placed and paid', at: o.created_at, done: true },
    { k: 'preparing', label: 'Being prepared', at: o.preparing_at, done: r >= 2 },
    { k: 'ready', label: dl ? 'Ready at the store' : 'Ready for pickup', at: o.ready_at, done: r >= 3 },
  ]
  if (dl) list.push({ k: 'picked', label: 'Picked up by courier', at: dl.picked_up_at, done: ['picked_up', 'delivered'].includes(dl.status) }, { k: 'done', label: 'Delivered', at: dl.delivered_at, done: dl.status === 'delivered' })
  else list.push({ k: 'done', label: 'Collected', at: o.status === 'completed' ? o.completed_at : null, done: o.status === 'completed' })
  const cur = list.findIndex((s) => !s.done)
  return list.map((s, i) => ({ ...s, state: s.done ? 'done' : i === cur ? 'now' : 'todo' }))
})

const courierLine = computed(() => {
  const dl = d.value
  if (!dl) return ''
  if (dl.status === 'accepted') return `Accepted at ${E.clock(dl.accepted_at)}`
  if (dl.status === 'picked_up') return `Picked up at ${E.clock(dl.picked_up_at)}`
  if (dl.status === 'delivered') return `Delivered at ${E.clock(dl.delivered_at)}`
  return ''
})
</script>

<template>
  <section v-if="order && store" class="page track">
    <div class="bar">
      <button class="icon-btn" aria-label="Back" @click="ui.back()">
        <Icon name="back" :size="20" />
      </button>
      <div class="bar-title">
        <h3>Order #{{ order.code }}</h3><small>{{ store.name }} · {{ venueName }}</small>
      </div>
      <span class="live"><i></i>Live</span>
    </div>
    <div class="scroll track-body">
      <div class="container px-0">
      <div class="row g-2">
      <div class="col-12 col-lg-7 d-flex flex-column gap-2">
      <div v-if="order.fallback" class="fallback-note">
        <Icon name="bag" :size="16" /><span><strong>Switched to pickup.</strong> No courier accepted within {{
          cfg.deliveryWindowMin }} min, so the delivery fee was waived.</span>
      </div>
      <div class="status-card" :class="'tone-' + phase.tone">
        <small class="eyebrow">{{ phase.title }}</small>
        <template v-if="q && (order.status === 'paid' || order.status === 'preparing')">
          <div class="status-big">Ready ~{{ E.clock(q.readyAt) }}</div>
          <p v-if="order.status === 'paid'">About {{ E.minsUntil(now, q.readyAt) }} min</p>
          <p v-else>About {{ E.minsUntil(now, q.readyAt) }} min<template v-if="order.preparing_at"> · cooking since {{
            E.clock(order.preparing_at) }}</template>
          </p>
          <div class="why">
            <span>
              <Icon name="receipt" :size="12" />{{ q.ahead }} orders ahead
            </span>
          </div>
        </template>
        <template v-else>
          <div class="status-big">{{ phase.big }}</div>
          <p>{{ phase.sub }}</p>
          <p v-if="walkSeconds" class="walk-leg">
            <Icon name="walk" :size="12" />About {{ Math.max(1, Math.round(walkSeconds / 60)) }} min walk to {{ drop ?
              drop.name : 'you' }}
          </p>
        </template>
      </div>

      <div v-if="d && !order.fallback" class="panel courier" :class="'c-' + d.status">
        <template v-if="d.status === 'open'">
          <div class="c-head"><span class="c-ic">
              <Icon name="bike" :size="20" />
            </span>
            <div><strong>Finding a student courier</strong><small>Switches to pickup in {{ E.countdown(d.expires_at -
                now) }} if nobody accepts</small></div>
          </div>
          <div class="meter"
            :class="(d.expires_at - now) < 120e3 ? 'late' : (d.expires_at - now) < 300e3 ? 'warn' : 'ok'"><i
              :style="{ width: Math.max(0, (d.expires_at - now) / (cfg.deliveryWindowMin * 600)) + '%' }"></i></div>
        </template>
        <template v-else-if="d.courier_name">
          <div class="c-head">
            <Avatar :name="d.courier_name" :size="40" tone="navy" />
            <div><strong>{{ d.courier_name }} is your courier</strong><small>{{ courierLine }}</small></div>
            <Icon v-if="d.status === 'delivered'" name="check" :size="20" class="c-done" />
          </div>
        </template>
        <div v-if="drop" class="c-drop">
          <Icon name="pin" :size="14" />{{ drop.name }}<template v-if="d.note"> · “{{ d.note }}”</template>
        </div>
      </div>

      <ol class="steps">
        <li v-for="s in steps" :key="s.k" :class="s.state"><i></i><span>{{ s.label }}</span><time v-if="s.at">{{
          E.clock(s.at)
            }}</time></li>
      </ol>

      </div>
      <div class="col-12 col-lg-5 d-flex flex-column gap-2">
      <ReceiptPanel :lines="lines" :discount="order.discount" :paid="order.paid" :payment="pay"
        :fallback="order.fallback" :fee-waived="order.fee_waived" />

      <button v-if="order.type === 'pickup'" 
        class="btn btn-outline-secondary btn-sm" 
        :disabled="order.status != 'ready' || busy[order.id]"
        @click="orders.markCollected(order.id)"
        >Collected
      </button>
      </div>
      </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Order tracking page (moved from the global stylesheet). Kept global: .page/.bar
   chrome, @keyframes live (shared with the top-bar offline dot), the .meter base
   (shared with the deliver tab) and .panel. */
.bar-title {
  flex: 1;
  min-width: 0;
}

.bar-title small {
  color: var(--muted);
  font-size: 12px;
}

.live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 800;
  color: var(--ok);
  background: var(--ok-soft);
  padding: 3px 9px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.live i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ok);
  animation: live 1.4s infinite;
}

.track-body {
  flex: 1;
  padding: 12px 14px 24px;
}

.fallback-note {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  background: var(--warn-soft);
  color: #6b4105;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 12.5px;
}

.status-card {
  border-radius: 20px;
  padding: 16px;
  color: #fff;
  background: var(--info);
}

.status-card.tone-brand {
  background: linear-gradient(140deg, #f06a43, var(--brand-600));
}

.status-card.tone-ok {
  background: linear-gradient(140deg, #1aa46f, #0c7049);
}

.status-card.tone-warn {
  background: linear-gradient(140deg, #e6a523, #b46d06);
}

.status-card.tone-info {
  background: linear-gradient(140deg, #3c74e8, #2148a8);
}

.status-card .eyebrow {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 800;
  font-size: 11.5px;
  opacity: 0.85;
}

.status-big {
  font-size: 27px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 2px 0 2px;
  font-variant-numeric: tabular-nums;
}

.status-card p {
  margin: 0;
  font-size: 13.5px;
  opacity: 0.95;
}

.why {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.why span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  padding: 3px 9px;
}

.courier {
  padding: 12px;
}

.c-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.c-head strong {
  display: block;
  font-size: 14px;
}

.c-head small {
  color: var(--muted);
  font-size: 12px;
}

.c-ic {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--warn-soft);
  color: var(--warn);
  display: grid;
  place-items: center;
  flex: none;
}

.c-done {
  margin-left: auto;
  color: var(--ok);
}

.courier .meter {
  margin-top: 10px;
}

.c-drop {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-2);
}

.steps {
  list-style: none;
  margin: 0;
  padding: 4px 6px;
}

.steps li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0 6px 2px;
  font-size: 13.5px;
  color: var(--muted);
}

.steps li i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #cdd2dd;
  background: var(--canvas);
  flex: none;
  position: relative;
  z-index: 1;
}

.steps li:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 8px;
  top: 22px;
  bottom: -8px;
  width: 2px;
  background: #dde1ea;
}

.steps li.done {
  color: var(--ink);
  font-weight: 600;
}

.steps li.done i {
  background: var(--ok);
  border-color: var(--ok);
}

.steps li.done:not(:last-child)::after {
  background: var(--ok);
}

.steps li.now {
  color: var(--ink);
  font-weight: 700;
}

.steps li.now i {
  border-color: var(--brand);
  box-shadow: 0 0 0 4px rgba(229, 81, 45, 0.18);
}

.steps time {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>
