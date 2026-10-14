<script setup>

import { computed } from 'vue'
import StoreMono from '../components/StoreMono.vue'
import { go, paths } from '../router'
import { money } from '../utils/format'
import { cart, setLineQty, cartSubtotal, cartDiscount, cartTotal } from '../cart'

function optionNames(line) {
  const names = []
  for (let group of line.item.option_groups) {
    for (let option of group.options) {
      if (line.option_ids.includes(option.id)) {
        names.push(option.name)
      }
    }
  }
  return names.join(', ')
}

</script>

<template>
  <div class="page-narrow">
    <h1 class="h4 fw-bold">Checkout</h1>

    <div v-if="cart.lines.length === 0" class="card">
      <div class="card-body">
        <p>Your cart is empty.</p>
        <button type="button" class="btn btn-brand" @click="go(paths.home)">Find food</button>
      </div>
    </div>

    <template v-else>
      <button type="button" class="btn btn-sm btn-outline-secondary mb-3" @click="go(paths.store(cart.store.id))">← {{ cart.store.name }}</button>

      <div class="card mb-3">
        <div class="card-header bg-white d-flex align-items-center gap-2">
          <StoreMono :name="cart.store.name" :size="38" />
          <div>
            <div class="fw-bold">{{cart.store.name}}</div>
            <div class="small text-muted">{{cart.store.description}}</div>
          </div>
        </div>
        <ul class="list-group list-group-flush">
          <li class="list-group-item d-flex align-items-center gap-3" v-for="(line, index) in cart.lines" :key="index">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" type="button" @click="setLineQty(index, line.qty - 1)">-</button>
              <span class="btn btn-light disabled">{{ line.qty }}</span>
              <button class="btn btn-outline-secondary" type="button" @click="setLineQty(index, line.qty + 1)">+</button>
            </div>
            <div class="flex-grow-1">
              <div class="fw-bold">{{ line.item.name }}</div>
              <div class="small text-muted">{{ optionNames(line) }}</div>
            </div>
            <b>{{ money(line.unit_price * line.qty) }}</b>
          </li>
        </ul>
      </div>

      <div class="alert alert-light border">
        <b>🛍️ Pickup</b>
        <div class="small text-muted">Collect it at the counter when it's ready</div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between"><span>Subtotal</span><span>{{ money(cartSubtotal) }}</span></div>
          <div class="d-flex justify-content-between text-success fw-bold" v-if="cartDiscount > 0"><span>Student discount {{ cart.store.discount_type === 'percentage' ? `(${cart.store.discount_per}%)` : '' }}</span><span>-{{ money(cartDiscount) }}</span></div>
          <hr />
          <div class="d-flex justify-content-between fw-bold fs-5"><span>Total</span><span>{{ money(cartTotal) }}</span></div>
        </div>
      </div>

      <div class="bottom-bar">
        <button type="button" class="btn btn-brand btn-lg w-100 shadow" @click="go(paths.pay)">Pay {{ money(cartTotal) }}</button>
      </div>
    </template>
  </div>
</template>
