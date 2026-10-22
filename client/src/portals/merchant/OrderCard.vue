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
  <article class="ocard" :class="['st-' + o.status, { fresh }]">
    <header>
      <b class="ocode">#{{ o.code }}</b>
      <span class="tag" :class="o.type === 'delivery' ? 'info' : 'muted'"><Icon :name="o.type === 'delivery' ? 'bike' : 'bag'" :size="11" />{{ o.type === 'delivery' ? 'Delivery' : 'Pickup' }}</span>
      <span class="waited" :class="tone" :title="'Waiting ' + waited + ' min'"><i></i>{{ waited < 1 ? 'new' : waited < 120 ? waited + ' min' : E.since(o.created_at, now) }}</span>
    </header>
    <div class="who">{{ shortName(o.student_name) }}</div>
    <ul class="olines"><li v-for="l in o.items" :key="l.id"><b>{{ l.qty }}×</b> {{ l.name }}<small v-if="l.option_names.length">{{ l.option_names.join(' · ') }}</small></li></ul>
    <div v-if="o.fallback" class="fb"><Icon name="bag" :size="12" />Switched to pickup · no courier</div>
    <footer>
      <span v-if="est && o.status !== 'ready'" class="est"><Icon name="clock" :size="12" />Ready ~{{ E.clock(est.readyAt) }}</span>
      <button v-if="o.status === 'paid'" class="btn btn-primary btn-sm" :disabled="busy[o.id]" @click="orders.startPreparing(o.id)">Start cooking</button>
      <button v-else-if="o.status === 'preparing'" class="btn btn-success btn-sm" :disabled="busy[o.id]" @click="orders.markReady(o.id)">Mark ready</button>
      <template v-else-if="o.status === 'ready'">
        <button v-if="o.type === 'pickup'" class="btn btn-outline-secondary btn-sm" :disabled="busy[o.id]" @click="orders.markCollected(o.id)">Collected</button>
        <span v-else-if="d && d.status === 'open'" class="courier warn"><Icon name="clock" :size="12" />Waiting for courier · {{ E.countdown(d.expires_at - now) }}</span>
        <span v-else-if="d && d.status === 'accepted'" class="courier ok"><Icon name="bike" :size="12" />{{ shortName(d.courier_name) }} is coming</span>
      </template>
    </footer>
  </article>
</template>
