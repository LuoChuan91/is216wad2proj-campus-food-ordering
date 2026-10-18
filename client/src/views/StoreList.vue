<script setup>

import { ref, computed, onMounted } from 'vue'
import StoreMono from '../components/StoreMono.vue'
import { DEMO } from '../demo'
import { go, paths } from '../router'
import { greeting, firstName, discountLabel, todayHours } from '../utils/format'
import axios from 'axios';

const stores = ref([])
const error = ref(false)
const loading = ref(true)
const search = ref()

async function loadStores() {
  try {
    let response = await axios.get('/api/stores')
    stores.value = response.data
  } catch(err) {
    error.value = true
  } finally {
    loading.value = false
  }
}

const search_results = computed(() => {
  if (!search.value) {
    return stores.value
  } else {
    return stores.value.filter(store => store.name.toLowerCase().includes(search.value.toLowerCase()))
  }
})

onMounted(loadStores)

</script>

<template>
  <div class="page-narrow">

    <h1 class="h4 fw-bold">{{ greeting() }}, {{ firstName(DEMO.studentName) }}</h1>

    <div class="input-group mb-3">
      <input class="form-control form-control-lg" type="search" placeholder="Search stores" aria-label="Search stores" v-model="search"/>
    </div>

    <h2 class="h6 text-uppercase text-muted">All stores <span class="badge text-bg-dark">{{ stores.length }}</span></h2>

    <p v-if="loading" class="text-muted">Loading stores…</p>
    <p v-else-if="error" class="text-danger">Couldn't load the stores. Is the server running?</p>
    <p v-else-if="search && search_results.length === 0" class="text-muted">No stores match {{ search }}.</p>

    <div v-else v-for="store in search_results" :key="store">
        <button type="button" class="card card-click mb-2" @click="go(paths.store(store.id))" :disabled="!store.is_open" :class="{ faded: !store.is_open }">
          <div class="card-body d-flex align-items-center gap-3 w-100">
            <StoreMono :name="store.name" />
            <div class="flex-grow-1">
              <div class="fw-bold">{{ store.name }}</div>
              <div class="small text-muted">{{ store.description }}</div>
              <div class="mt-1">
                <span class="badge me-1" :class=" store.is_open ? 'text-bg-success' : 'text-bg-secondary'">{{ store.is_open ? 'Open' : 'Closed' }}</span>
                <span class="badge text-bg-warning" v-if="store.discount_type === 'percentage'">{{ discountLabel(store) }}</span>
                <span class="badge text-bg-warning" v-else-if="store.discount_type === 'dollar'">${{ store.discount_dol.toFixed(2) }} discount</span>
              </div>
            </div>
            <div class="text-end small d-none d-sm-block"><div class="fw-bold">{{ store.is_open ? todayHours(store.open_hours) : 'Closed Today' }}</div></div>
          </div>
        </button>
    </div>
  </div>
</template>
