<script setup>
// The stores in one venue, opened from the map or the "Near you" list
import { computed } from 'vue'
import { S, Q, A } from '../../app/state'
import * as E from '../../app/engine'

const u = computed(() => S.ui.student)
const venue = computed(() => Q.venue(u.value.venueId))
const walk = computed(() => Q.walk(venue.value))
const stores = computed(() => Q.storesAt(venue.value.id).map((s) => ({ s, open: Q.open(s), wait: Q.storeWait(s.id) })))
</script>

<template>
  <div class="vsheet">
    <div class="grab"></div>
    <div class="vsheet-head">
      <div>
        <h3>{{ venue.name }}</h3>
        <p><Icon name="walk" :size="14" />{{ walk.minutes }} min walk · {{ walk.meters }} m <span class="src">{{ walk.source === 'osrm' ? 'OSRM walking route' : 'distance estimate' }}</span></p>
      </div>
      <button class="icon-btn" aria-label="Close" @click="A.closeSheet()"><Icon name="close" :size="18" /></button>
    </div>
    <div class="vsheet-list scroll">
      <p v-if="!stores.length" class="empty-note">No stores here yet.</p>
      <button v-for="x in stores" :key="x.s.id" class="store-card" :class="{ closed: !x.open.open }" @click="A.openStore(x.s.id)">
        <Mono :store="x.s" :size="46" />
        <span class="store-main">
          <strong>{{ x.s.name }}</strong>
          <small>{{ x.s.cuisine }} · {{ x.s.unit_no }}</small>
          <span class="tags">
            <span class="tag" :class="x.open.open ? 'ok' : 'muted'">{{ x.open.open ? 'Open' : 'Closed' }}</span>
            <span v-if="x.s.discount_type" class="tag brand">{{ E.discountShort(x.s) }}</span>
          </span>
        </span>
        <span class="store-wait" v-if="x.wait && x.open.open"><WaitChip :minutes="x.wait.minutes" /><small>{{ x.wait.ahead }} in queue</small></span>
      </button>
    </div>
  </div>
</template>
