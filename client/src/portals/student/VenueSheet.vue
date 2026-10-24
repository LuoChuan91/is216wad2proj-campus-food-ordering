<script setup>
// The stores in one venue, opened from the map or the "Near you" list
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import * as E from '@/utils/engine.js'
import WaitTimeEstimate from '@/components/WaitTimeEstimate.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const { ui: uiState } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const venue = computed(() => catalog.venue(u.value.venueId))
const walk = computed(() => ui.walk(venue.value))
const stores = computed(() => catalog.storesAt(venue.value.id).map((s) => ({ s, open: ui.open(s), available: catalog.storeAvailable(s) })))
</script>

<template>
  <div class="vsheet col-md-8 col-lg-6 mx-auto">
    <div class="grab"></div>
    <div class="vsheet-head d-flex justify-content-between align-items-start gap-2">
      <div>
        <h3>{{ venue.name }}</h3>
        <p class="d-flex align-items-center flex-wrap gap-1">
          <Icon name="walk" :size="14" />{{ walk.minutes }} min walk · {{ walk.meters }} m <span class="src">{{
            walk.source === 'osrm' ? 'OSRM walking route' : 'distance estimate' }}</span>
        </p>
      </div>
      <button class="icon-btn" aria-label="Close" @click="ui.closeSheet()">
        <Icon name="close" :size="18" />
      </button>
    </div>
    <div class="vsheet-list scroll d-grid gap-2">
      <p v-if="!stores.length" class="empty-note">No stores here yet.</p>
      <button v-for="x in stores" :key="x.s.id" class="store-card d-flex align-items-center gap-3 w-100 p-2 text-start bg-white border rounded-4"
        :class="{ 'opacity-75': x.available && !x.open.open, 'opacity-50': !x.available }"
        :disabled="!x.available" @click="ui.openStore(x.s.id)">
        <Mono :store="x.s" :size="46" />
        <span class="d-flex flex-column flex-grow-1 overflow-hidden">
          <strong>{{ x.s.name }}</strong>
          <small class="text-body-secondary">{{ x.s.cuisine }} · {{ x.s.unit_no }}</small>
          <span class="d-flex flex-wrap gap-1 mt-1">
            <span v-if="!x.available" class="tag muted">Unavailable</span>
            <span v-else class="tag" :class="x.open.open ? 'ok' : 'muted'">{{ x.open.open ? 'Open' : 'Closed' }}</span>
            <span v-if="x.s.discount_type" class="tag brand">{{ E.discountShort(x.s) }}</span>
          </span>
        </span>
        <span v-if="x.available && x.open.open" class="flex-shrink-0">
          <WaitTimeEstimate :store-id="x.s.id" />
        </span>
      </button>
    </div>
  </div>
</template>
