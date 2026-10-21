<script setup>
// Live tracking of one order: ready time from the kitchen queue, the courier, and every step
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'
import { config as cfg } from '../../app/config'
import { shortName } from '../../app/landmarks'
import { estimateWalkingSeconds } from '@/utils/mapApi.js'

const u = computed(() => S.ui.student)
const money = E.money
const first = (name) => (name || '').split(' ')[0]
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const order = computed(() => Q.order(u.value.trackOrderId))
const store = computed(() => Q.store(order.value.store_id))
const venue = computed(() => Q.venue(store.value.venue_id))
const venueName = computed(() => (venue.value ? shortName(venue.value.name) : ''))
const lines = computed(() => order.value.items)
const d = computed(() => order.value.delivery)
const drop = computed(() => d.value && Q.dropoff(d.value.destination_id))
const q = computed(() => S.waits.orders[order.value.id])
const pay = computed(() => order.value.payment)
const firstItem = computed(() => lines.value[0] && Q.item(lines.value[0].menu_item_id))
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
  if (o.status === 'completed' && delivering.value) return { tone: 'ok', title: 'Delivered', big: 'Enjoy your meal', sub: `Dropped at ${drop.value ? drop.value.name : 'your drop-off point'}${dl.delivered_at ? ', ' + E.clock(dl.delivered_at) : ''}` }
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
  <section class="page track">
    <div class="bar">
      <button class="icon-btn" aria-label="Back" @click="A.back()"><Icon name="back" :size="20" /></button>
      <div class="bar-title"><h3>Order #{{ order.code }}</h3><small>{{ store.name }} · {{ venueName }}</small></div>
      <span class="live"><i></i>Live</span>
    </div>
    <div class="scroll track-body">
      <div v-if="order.fallback" class="fallback-note"><Icon name="bag" :size="16" /><span><strong>Switched to pickup.</strong> No courier accepted within {{ cfg.deliveryWindowMin }} min, so the delivery fee was waived.</span></div>
      <div class="status-card" :class="'tone-' + phase.tone">
        <small class="eyebrow">{{ phase.title }}</small>
        <template v-if="q && (order.status === 'paid' || order.status === 'preparing')">
          <div class="status-big">Ready ~{{ E.clock(q.readyAt) }}</div>
          <p v-if="order.status === 'paid'">About {{ E.minsUntil(S.now, q.readyAt) }} min · <b>{{ plural(q.ahead, 'order', 'orders') }} ahead of you</b></p>
          <p v-else>About {{ E.minsUntil(S.now, q.readyAt) }} min<template v-if="order.preparing_at"> · cooking since {{ E.clock(order.preparing_at) }}</template></p>
          <div class="why">
            <span><Icon name="receipt" :size="12" />{{ q.ahead }} ahead · {{ plural(q.dishesAhead, 'dish', 'dishes') }}</span>
            <span><Icon name="flame" :size="12" />Kitchen cooks {{ S.waits.slots }} at once</span>
            <span v-if="firstItem"><Icon name="clock" :size="12" />{{ Math.max(1, Math.round(firstItem.cook_time_sec / 60)) }} min per batch</span>
          </div>
        </template>
        <template v-else>
          <div class="status-big">{{ phase.big }}</div>
          <p>{{ phase.sub }}</p>
          <p v-if="walkSeconds" class="walk-leg"><Icon name="walk" :size="12" />About {{ Math.max(1, Math.round(walkSeconds / 60)) }} min walk to {{ drop ? drop.name : 'you' }}</p>
        </template>
      </div>

      <div v-if="d && !order.fallback" class="panel courier" :class="'c-' + d.status">
        <template v-if="d.status === 'open'">
          <div class="c-head"><span class="c-ic"><Icon name="bike" :size="20" /></span><div><strong>Finding a student courier</strong><small>Switches to pickup in {{ E.countdown(d.expires_at - S.now) }} if nobody accepts</small></div></div>
          <div class="meter" :class="(d.expires_at - S.now) < 120e3 ? 'late' : (d.expires_at - S.now) < 300e3 ? 'warn' : 'ok'"><i :style="{ width: Math.max(0, (d.expires_at - S.now) / (cfg.deliveryWindowMin * 600)) + '%' }"></i></div>
        </template>
        <template v-else-if="d.courier_name">
          <div class="c-head"><Avatar :name="d.courier_name" :size="40" tone="navy" /><div><strong>{{ d.courier_name }} is your courier</strong><small>{{ courierLine }}</small></div><Icon v-if="d.status === 'delivered'" name="check" :size="20" class="c-done" /></div>
        </template>
        <div v-if="drop" class="c-drop"><Icon name="pin" :size="14" />{{ drop.name }}<template v-if="d.note"> · “{{ d.note }}”</template></div>
      </div>

      <ol class="steps">
        <li v-for="s in steps" :key="s.k" :class="s.state"><i></i><span>{{ s.label }}</span><time v-if="s.at">{{ E.clock(s.at) }}</time></li>
      </ol>

      <div class="panel receipt">
        <div v-for="l in lines" :key="l.id" class="co-line"><span class="co-qty">{{ l.qty }}×</span><div class="co-what"><strong>{{ l.name }}</strong><small v-if="l.option_names.length">{{ l.option_names.join(', ') }}</small></div><b>{{ money(l.unit_price * l.qty) }}</b></div>
        <div v-if="order.discount" class="rc-row disc"><span>Discount</span><b>−{{ money(order.discount) }}</b></div>
        <div class="rc-row"><span>Paid</span><b>{{ money(order.paid) }}</b></div>
        <small v-if="pay" class="rc-ref">{{ pay.reference }} · {{ pay.method }}<template v-if="order.fallback"> · {{ money(order.fee_waived) }} fee waived</template></small>
      </div>
    </div>
  </section>
</template>
