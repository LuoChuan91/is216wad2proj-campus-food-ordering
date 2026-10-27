<script setup>
// The stores in one venue, opened from the map or the "Near you" list
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import StoreCard from '@/components/StoreCard.vue'

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
      <StoreCard v-for="x in stores" :key="x.s.id" :store="x.s" :open="x.open.open" :available="x.available">
        <small class="text-body-secondary">{{ x.s.cuisine }} · {{ x.s.unit_no }}</small>
      </StoreCard>
    </div>
  </div>
</template>
