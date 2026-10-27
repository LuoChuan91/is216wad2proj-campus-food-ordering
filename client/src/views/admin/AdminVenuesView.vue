<script setup>
// Admin venues body: add a venue by clicking the map.
//
// Migrated from the venues half of portals/admin/AdminApp.vue. The rail and header
// live in the AdminView shell; this is the routed body for #/admin/venues. AdminMap
// is kept as a component.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import AdminMap from '@/portals/admin/AdminMap.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const { ui: uiState } = storeToRefs(ui)

const t = computed(() => uiState.value.staff)
const venues = computed(() => catalog.db.venues.map((v) => ({ v, stores: catalog.storesAt(v.id).length })))
</script>

<template>
  <div class="adm-venues">
    <div class="row g-0 h-100 flex-column flex-md-row flex-nowrap">
    <div class="av-side scroll col col-md-4 d-flex flex-column gap-2">
      <form class="av-form d-grid gap-2" @submit.prevent="orders.addVenue()">
        <strong>Add a venue</strong>
        <label for="venue-name">Name</label>
        <input id="venue-name" class="form-control form-control-sm" placeholder="e.g. SMU Labs" :value="t.venueDraft.name" @input="ui.setVenueDraft('name', $event.target.value)">
        <div class="av-ll"><span>{{ t.venueDraft.lat ? t.venueDraft.lat + ', ' + t.venueDraft.lng : 'Click the map to drop the pin' }}</span></div>
        <p v-if="t.formError" class="av-err">{{ t.formError }}</p>
        <button class="btn btn-primary btn-sm w-100" type="submit" :disabled="t.saving">{{ t.saving ? 'Adding…' : 'Add venue' }}</button>
      </form>
      <div v-for="x in venues" :key="x.v.id" class="av-row d-flex align-items-center gap-2"><Icon name="pin" :size="14" /><div><strong class="d-block">{{ x.v.name }}</strong><small>{{ x.stores }} {{ x.stores === 1 ? 'store' : 'stores' }} · {{ Number(x.v.lat).toFixed(4) }}, {{ Number(x.v.lng).toFixed(4) }}</small></div></div>
    </div>
    <AdminMap class="col col-md-8 order-first order-md-last" />
    </div>
  </div>
</template>

<style scoped>
/* Admin venues: form + list beside the map (moved from the global stylesheet). */
.adm-venues {
  flex: 1;
  min-height: 0;
}
.av-side {
  padding: 12px;
  background: var(--paper);
}
.av-form {
  background: var(--canvas);
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 6px;
}
.av-form label {
  font-size: var(--fs-caption);
  font-weight: 700;
  color: var(--ink-2);
}
.av-ll {
  font-size: var(--fs-caption);
  color: var(--ink-2);
  font-family: var(--font-mono);
  background: var(--paper);
  border: 1px dashed #cfd4e0;
  border-radius: 8px;
  padding: 6px 8px;
}
.av-err {
  color: var(--late);
  font-size: var(--fs-caption);
  margin: 0;
}
.av-row {
  padding: 6px 4px;
}
.av-row strong {
  font-size: var(--fs-desc);
}
.av-row small {
  color: var(--muted);
  font-size: var(--fs-micro);
  font-family: var(--font-mono);
}
</style>
