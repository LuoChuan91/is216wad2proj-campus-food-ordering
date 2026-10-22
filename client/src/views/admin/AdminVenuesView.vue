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
    <div class="av-side scroll">
      <form class="av-form" @submit.prevent="orders.addVenue()">
        <strong>Add a venue</strong>
        <label for="venue-name">Name</label>
        <input id="venue-name" class="form-control form-control-sm" placeholder="e.g. SMU Labs" :value="t.venueDraft.name" @input="ui.setVenueDraft('name', $event.target.value)">
        <div class="av-ll"><span>{{ t.venueDraft.lat ? t.venueDraft.lat + ', ' + t.venueDraft.lng : 'Click the map to drop the pin' }}</span></div>
        <p v-if="t.formError" class="av-err">{{ t.formError }}</p>
        <button class="btn btn-primary btn-sm w-100" type="submit" :disabled="t.saving">{{ t.saving ? 'Adding…' : 'Add venue' }}</button>
      </form>
      <div v-for="x in venues" :key="x.v.id" class="av-row"><Icon name="pin" :size="14" /><div><strong>{{ x.v.name }}</strong><small>{{ x.stores }} {{ x.stores === 1 ? 'store' : 'stores' }} · {{ Number(x.v.lat).toFixed(4) }}, {{ Number(x.v.lng).toFixed(4) }}</small></div></div>
    </div>
    <AdminMap />
  </div>
</template>

<style scoped>
/* Admin venues: form + list beside the map (moved from the global stylesheet). */
.adm-venues {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 290px 1fr;
}
.av-side {
  padding: 12px;
  border-right: 1px solid var(--line);
  background: var(--paper);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.av-form {
  display: grid;
  gap: 6px;
  background: var(--canvas);
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 6px;
}
.av-form label {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-2);
}
.av-ll {
  font-size: 12px;
  color: var(--ink-2);
  font-family: var(--font-mono);
  background: var(--paper);
  border: 1px dashed #cfd4e0;
  border-radius: 8px;
  padding: 6px 8px;
}
.av-err {
  color: var(--late);
  font-size: 12px;
  margin: 0;
}
.av-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
}
.av-row strong {
  display: block;
  font-size: 13px;
}
.av-row small {
  color: var(--muted);
  font-size: 11px;
  font-family: var(--font-mono);
}
</style>
