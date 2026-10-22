<script setup>
// Admin venues body: add a venue by clicking the map.
//
// Migrated from the venues half of portals/admin/AdminApp.vue. The rail and header
// live in the AdminView shell; this is the routed body for #/admin/venues. AdminMap
// is kept as a component.
import { computed } from 'vue'
import { S, Q, A } from '@/stores/compat.js'
import AdminMap from '@/portals/admin/AdminMap.vue'

const t = computed(() => S.ui.staff)
const venues = computed(() => S.db.venues.map((v) => ({ v, stores: Q.storesAt(v.id).length })))
</script>

<template>
  <div class="adm-venues">
    <div class="av-side scroll">
      <form class="av-form" @submit.prevent="A.addVenue()">
        <strong>Add a venue</strong>
        <label for="venue-name">Name</label>
        <input id="venue-name" class="form-control form-control-sm" placeholder="e.g. SMU Labs" :value="t.venueDraft.name" @input="A.setVenueDraft('name', $event.target.value)">
        <div class="av-ll"><span>{{ t.venueDraft.lat ? t.venueDraft.lat + ', ' + t.venueDraft.lng : 'Click the map to drop the pin' }}</span></div>
        <p v-if="t.formError" class="av-err">{{ t.formError }}</p>
        <button class="btn btn-primary btn-sm w-100" type="submit" :disabled="t.saving">{{ t.saving ? 'Adding…' : 'Add venue' }}</button>
      </form>
      <div v-for="x in venues" :key="x.v.id" class="av-row"><Icon name="pin" :size="14" /><div><strong>{{ x.v.name }}</strong><small>{{ x.stores }} {{ x.stores === 1 ? 'store' : 'stores' }} · {{ Number(x.v.lat).toFixed(4) }}, {{ Number(x.v.lng).toFixed(4) }}</small></div></div>
    </div>
    <AdminMap />
  </div>
</template>
