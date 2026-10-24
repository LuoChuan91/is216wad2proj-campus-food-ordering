<script setup>
// One order on the kitchen board
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useOrdersStore } from '@/stores/orders.js'
import * as E from '@/utils/engine.js'

const ui = useUiStore()
const orders = useOrdersStore()
const { now, busy } = storeToRefs(ui)

const props = defineProps({ o: Object, est: Object })
const shortName = (n) => { const [a, b] = (n || 'Student').split(' '); return b ? `${a} ${b[0]}.` : a }
const d = computed(() => props.o.delivery)
const waited = computed(() => Math.floor((now.value - props.o.created_at) / 60000))
const tone = computed(() => (waited.value < 5 ? 'ok' : waited.value < 10 ? 'warn' : 'late'))
// Highlight orders that just came in (the animation plays once when the card appears)
const fresh = props.o.status === 'paid' && now.value - props.o.created_at < 20e3
</script>

<template>
  <article class="ocard d-grid gap-2 flex-shrink-0" :class="['st-' + o.status, { fresh }]">
    <header class="d-flex align-items-center gap-2">
      <b class="ocode">#{{ o.code }}</b>
      <span class="tag" :class="o.type === 'delivery' ? 'info' : 'muted'"><Icon :name="o.type === 'delivery' ? 'bike' : 'bag'" :size="11" />{{ o.type === 'delivery' ? 'Delivery' : 'Pickup' }}</span>
      <span class="waited ms-auto d-inline-flex align-items-center gap-1" :class="tone" :title="'Waiting ' + waited + ' min'"><i></i>{{ waited < 1 ? 'new' : waited < 120 ? waited + ' min' : E.since(o.created_at, now) }}</span>
    </header>
    <div class="who">{{ shortName(o.student_name) }}</div>
    <ul class="olines list-unstyled m-0 d-grid"><li v-for="l in o.items" :key="l.id"><b>{{ l.qty }}×</b> {{ l.name }}<small v-if="l.option_names.length" class="d-block">{{ l.option_names.join(' · ') }}</small></li></ul>
    <div v-if="o.fallback" class="fb d-flex align-items-center gap-1"><Icon name="bag" :size="12" />Switched to pickup · no courier</div>
    <footer class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
      <span v-if="est && o.status !== 'ready'" class="est d-inline-flex align-items-center gap-1"><Icon name="clock" :size="12" />Ready ~{{ E.clock(est.readyAt) }}</span>
      <button v-if="o.status === 'paid'" class="btn btn-primary btn-sm ms-auto" :disabled="busy[o.id]" @click="orders.startPreparing(o.id)">Start cooking</button>
      <button v-else-if="o.status === 'preparing'" class="btn btn-success btn-sm ms-auto" :disabled="busy[o.id]" @click="orders.markReady(o.id)">Mark ready</button>
      <template v-else-if="o.status === 'ready'">
        <span v-if="o.type === 'pickup' && o.status != 'completed'" class="courier d-inline-flex align-items-center gap-1"><Icon name="user" :size="12" />Customer is coming</span>
        <span v-else-if="d && d.status === 'open'" class="courier warn d-inline-flex align-items-center gap-1"><Icon name="clock" :size="12" />Waiting for courier · {{ E.countdown(d.expires_at - now) }}</span>
        <span v-else-if="d && d.status === 'accepted'" class="courier ok d-inline-flex align-items-center gap-1"><Icon name="bike" :size="12" />{{ shortName(d.courier_name) }} is coming</span>
      </template>
    </footer>
  </article>
</template>

<style scoped>
/* Kitchen-board order card (moved from the global prototype stylesheet). */
.ocard {
  background: var(--paper);
  border-radius: 14px;
  padding: 10px;
  border: 1px solid var(--line);
}
.ocard.st-preparing {
  border-left: 4px solid var(--brand);
}
.ocard.st-ready {
  border-left: 4px solid var(--ok);
}
.ocard.fresh {
  animation: fresh 2.8s ease;
}
@keyframes fresh {
  0%,
  40% {
    box-shadow:
      0 0 0 3px var(--brand),
      0 8px 24px rgba(229, 81, 45, 0.35);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(229, 81, 45, 0);
  }
}
.ocode {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.waited {
  font-size: 11px;
  font-weight: 800;
}
.waited i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.waited.ok {
  color: var(--ok);
}
.waited.warn {
  color: #c47d08;
}
.waited.late {
  color: var(--late);
}
.who {
  font-weight: 700;
}
.olines {
  font-size: 12.5px;
}
.olines small {
  color: var(--muted);
  font-size: 11.5px;
}
.fb {
  background: var(--warn-soft);
  color: #7a4c06;
  font-weight: 700;
  font-size: 11.5px;
  border-radius: 8px;
  padding: 4px 8px;
}
.est {
  color: var(--ink-2);
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.courier.warn,
.courier.ok {
  font-size: 11.5px;
  font-weight: 700;
  padding: 0;
  border: 0;
  background: none;
}
.courier.warn {
  color: #9c6206;
}
.courier.ok {
  color: var(--ok);
}
</style>
