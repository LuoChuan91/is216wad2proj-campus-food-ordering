<script setup>

import { ref, computed, onMounted } from 'vue'
import { closeSheet } from '../router'
import { money, ruleLabel } from '../utils/format'
import axios from 'axios';
import { cart, addToCart } from '../cart'

const item = ref()
const store = ref()
const loading = ref(true)
const chosenOptions = ref({})
const quantity = ref(1)

async function loadDish() {
  try {
    let response1 = await axios.get(`/api/menu/${props.itemId}`)
    item.value = response1.data
    for (let group of item.value.option_groups) {
      if (group.type === 'multi') {
        chosenOptions.value[group.id] = []
      } else {
        chosenOptions.value[group.id] = ''
      }
    }
    let response2 = await axios.get(`/api/stores/${item.value.store_id}`)
    store.value = response2.data
  } catch(err) {
    console.error(err.message)
  } finally {
    loading.value = false
  }
}

function OptionCounter(group) {
  if (Array.isArray(chosenOptions.value[group.id])) {
    return chosenOptions.value[group.id].length
  } else if (chosenOptions.value[group.id]) {
    return 1
  } else {
    return 0
  }
}

function groupValid(group) {
  const count = OptionCounter(group)
  const min = group.required ? Math.max(group.min_select, 1) : group.min_select
  const max = group.max_select
  if (count>=min && count <= max) {
    return true
  }
  return false
}

function minusCount() {
  quantity.value -= 1
}

function plusCount() {
  quantity.value += 1
}

function addAndGoBack () {
  let arr = []
  for (let group in chosenOptions.value) {
    if (Array.isArray(chosenOptions.value[group])) {
      for (let option of chosenOptions.value[group]) {
        arr.push(option)
      }
    } else if (chosenOptions.value[group]) {
      arr.push(chosenOptions.value[group])
    }
  }
  addToCart(store.value, item.value, quantity.value, arr, unitPrice.value)
  closeSheet()
}

const unitPrice = computed(() => {
  let option_price = 0
  for (let group of item.value.option_groups) {
    const chosen = chosenOptions.value[group.id]
    for (let option of group.options) {
      if (group.type === 'multi') {
        if (chosen.includes(option.id)) {
          option_price += Number(option.price_delta)
        }
      } else if (chosen === option.id) {
        option_price += Number(option.price_delta)
      }
    }
  }
  return item.value.price + option_price
})

const totalPrice = computed(() => unitPrice.value * quantity.value)

const allValid = computed(() => {
  return item.value.option_groups.every(group => groupValid(group))
})

onMounted(loadDish)

const props = defineProps({ itemId: { type: String, required: true } })
</script>

<template>
  <div class="page-narrow">

    <p v-if="loading" class="text-muted">Loading…</p>
    <p v-else-if="!item" class="text-danger">Couldn't load dish!</p>
    <template v-else>

      <button type="button" class="btn btn-sm btn-outline-secondary mb-3" @click="closeSheet">← {{ store.name }}</button>
      <h1 class="h4 fw-bold mb-1">{{item.name}}</h1>
      <p class="text-muted">{{ item.description }}<b class="text-body"> From {{ money(item.price) }}</b></p>

      <div class="card mb-3" v-for="group in item.option_groups" :key="group">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
          <span class="fw-bold">{{ group.name }}</span>
          <span class="badge" :class="groupValid(group) ? 'text-bg-success' : 'text-bg-warning'">{{ OptionCounter(group) }} selected</span>
        </div>
        <div class="list-group list-group-flush" v-for="(option, index) in group.options" :key="index">
          <label class="list-group-item list-group-item-warning d-flex align-items-center gap-2" >
            <input class="form-check-input mt-0" :type="group.type === 'multi' ? 'checkbox' : 'radio'" :name="group.name" :value="option.id" v-model="chosenOptions[group.id]"/>
            <span class="flex-grow-1">{{ option.name }}</span>
            <span class="small text-muted" v-if="option.price_delta > 0">+{{ money(option.price_delta) }}</span>
          </label>
        </div>
      </div>

      <div class="bottom-bar card shadow">
        <div class="card-body d-flex align-items-center gap-3">
          <div class="input-group w-auto flex-nowrap">
            <button class="btn btn-outline-secondary" type="button" @click="minusCount()" :disabled="quantity === 1">-</button>
            <span class="input-group-text bg-white">{{ quantity }}</span>
            <button class="btn btn-outline-secondary" type="button" @click="plusCount()">+</button>
          </div>
          <button type="button" class="btn btn-brand btn-lg flex-grow-1" @click="addAndGoBack()" :disabled="!allValid">Add to cart · {{ money(totalPrice) }}</button>
        </div>
      </div>
    </template>
  </div>
</template>
