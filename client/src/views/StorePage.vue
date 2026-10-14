<script setup>
import { ref, computed, onMounted } from 'vue'
import StoreMono from '../components/StoreMono.vue'
import { DEMO } from '../demo'
import { cart } from '../cart'
import { go, paths } from '../router'
import { money, discountLabel, todayHours, storeColour } from '../utils/format'
import axios from 'axios';

const props = defineProps({ storeId: { type: String, required: true } })
const loading = ref(true)
const store = ref()
const items = ref([])

async function loadStore() {
  try {
    let response = await axios.get(`/api/stores/${props.storeId}`)
    store.value = response.data
  } catch(err) {
    console.error(err.message)
  } finally {
    loading.value = false
  }
}

async function getItem() {
  try {
    if (props.storeId === DEMO.storeId) { 
      let response = await axios.get(`/api/menu/${DEMO.menuItemId}`)
      items.value = [response.data]
    } 
  } catch (err) {
    console.error(err.message)
  }
}

onMounted(() => {
  loadStore();
  getItem();
})

const findQuantity = computed(() => {
  return cart.value.lines.reduce((sum, line) => {
            return sum + line.qty
  }, 0)
  
})

const findTotal = computed(() => {
  return money(cart.value.lines.reduce((sum, line) => {
            return sum + line.qty*line.unit_price
  }, 0))
})

</script>

<template>
  <div class="page-narrow">
    <button type="button" class="btn btn-sm btn-outline-secondary mb-3" @click="go(paths.home)">← Back</button>

    <p v-if="loading" class="text-muted">Loading…</p>
    <p v-else-if="!store" class="text-danger">Couldn't load this store.</p>

    <template v-else>
      <div class="card mb-3 store-header" :style="{ borderTopColor: storeColour(store.name) }">
        <div class="card-body d-flex align-items-center gap-3">
          <StoreMono :name="store.name" />
          <div>
            <h1 class="h4 fw-bold mb-0">{{ store.name }}</h1>
            <div class="small text-muted">{{ store.description }}</div>
          </div>
        </div>
        
        <div class="card-footer bg-white">
          <span class="badge text-bg-success me-1" v-if="store.is_open">{{ store.is_open ? 'Open · ' : '' }}{{ todayHours(store.open_hours) }}</span>
          <span class="badge text-bg-secondary" v-else>Paused by the store</span>
          <span class="badge text-bg-warning" v-if="store.discount_type && store.is_open">{{ discountLabel(store) }}</span>
        </div>
      </div>

      <!-- Step 4 -->
      <h2 class="h6 text-uppercase text-muted">Menu</h2>
      <template v-for="item in items" :key="item.id">
        <button type="button" class="card card-click mb-2" @click="go(paths.item(store.id, item.id))" :disabled="!item.available || !store.is_open" :class="{ faded: !item.available }">
          <div class="card-body d-flex justify-content-between align-items-center gap-3 w-100">
            <div>
              <div class="fw-bold">{{ item.name }}</div>
              <div class="small text-muted">{{ item.description }}</div>
              <div class="mt-1">
                <span class="fw-bold me-2">{{ money(item.price) }}</span>
                <span v-if="item.option_groups.length > 0" class="badge text-bg-light border">Customisable</span>
                <span v-if="!item.available" class="badge text-bg-light border">Sold out</span>
              </div>
            </div>
            <span class="btn btn-brand rounded-circle" v-if="item.available && store.is_open">+</span>
          </div>
        </button>
      </template>
      <p v-if="items.length === 0" class="text-muted">This store's menu isn't online yet.</p>

      <div class="bottom-bar mt-3" v-if="cart.lines.length > 0 && cart.store && cart.store.id === props.storeId">
        <button type="button" class="btn btn-dark btn-lg w-100 d-flex justify-content-between" @click="go(paths.checkout)">
          <span><span class="badge bg-danger">{{ findQuantity }}</span> View cart</span>
          <span>{{ findTotal }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.store-header {
  border-top-width: 6px;
}
</style>
