<script setup>
/*
  Student: choose a dish's options and quantity, then add it to the cart.
  The address gives the dish's id (the itemId prop).

  The template below is the finished layout with the real Chicken Teriyaki Bento. Swap the
  sample text for real data. Steps:

  1. Load the dish (onMounted)
     - GET `/api/menu/${props.itemId}` -> `item`. It has name, description, price, store_id,
       and option_groups, each with its options.
     - Also GET `/api/stores/${item.store_id}` -> `store`, for the back button and the cart.
     - Until both arrive, show only the "Loading…" line.

  2. Header: name, description, "From " + money(price). The back button is already wired.

  3. Option groups: one card per group, and in it one <label class="list-group-item"> per
     option (v-for), each with an <input>.
     - Keep the chosen option ids in one ref array, e.g. `chosen`.
     - The input is type "radio" for 'single' groups and "checkbox" for 'multi' groups.
       Bind :checked (is it in `chosen`?) and handle @click.
     - In a 'single' group, clicking an option replaces that group's choice. In a 'multi'
       group it adds or removes it, but never past max_select.
     - Disable the input (and add the class `faded` to the label) when the option isn't
       available, or a multi group is already full. Add `list-group-item-warning` to the
       label when it's chosen.
     - Show the +price only when price_delta > 0.
     - The badge next to the group's name, same rule as the server (at least min_select,
       at least 1 if required, at most max_select):
         valid                -> text-bg-success, "✓ Chosen" (single) or "✓ 2 picked" (multi)
         some picked, too few -> text-bg-warning, "1 of 3 minimum"
         nothing picked       -> text-bg-light border, ruleLabel(group)

  4. Quantity: a ref starting at 1. The − button never goes below 1.

  5. The add button
     - Disabled until every group is valid. Then "Add to cart · " + money(unit price x qty),
       where unit price = price + the price_delta of each chosen option (use Number()).
     - While a group isn't valid, show a hint instead, e.g. "Choose a rice" or "Pick 2 more extras".
     - On click: add it to the cart (cart.js), then closeSheet() goes back to the store.
*/
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

      <!-- Step 3: one card per option group -->
      <div class="card mb-3" v-for="group in item.option_groups" :key="group">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
          <span class="fw-bold">{{ group.name }}</span>
          <span class="badge" :class="OptionCounter(group) < group.min_select || OptionCounter(group) > group.max_select ? 'text-bg-warning' : 'text-bg-success' ">{{ OptionCounter(group) }} selected</span>
        </div>
        <div class="list-group list-group-flush" v-for="(option, index) in group.options" :key="index">
          <!-- one label per option -->
          <label class="list-group-item list-group-item-warning d-flex align-items-center gap-2" >
            <input class="form-check-input mt-0" :type="group.type === 'multi' ? 'checkbox' : 'radio'" :name="group.name" :value="option.id" v-model="chosenOptions[group.id]"/>
            <span class="flex-grow-1">{{ option.name }}</span>
            <span class="small text-muted" v-if="option.price_delta > 0">+{{ money(option.price_delta) }}</span>
          </label>
        </div>
      </div>

      <!-- Steps 4 and 5 -->
      <div class="bottom-bar card shadow">
        <div class="card-body d-flex align-items-center gap-3">
          <div class="input-group w-auto flex-nowrap">
            <button class="btn btn-outline-secondary" type="button" @click="minusCount()" :disabled="quantity === 1">-</button>
            <span class="input-group-text bg-white">{{ quantity }}</span>
            <button class="btn btn-outline-secondary" type="button" @click="plusCount()">+</button>
          </div>
          <button type="button" class="btn btn-brand btn-lg flex-grow-1" @click="addAndGoBack()">Add to cart · {{ money(totalPrice) }}</button>
        </div>
      </div>
    </template>
  </div>
</template>
