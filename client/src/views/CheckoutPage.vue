<script setup>
/*
  Student: checkout. Everything here comes from the cart (cart.js), so nothing to load.

  The template below is the finished layout with a sample cart: 2 bentos with white rice and
  tamago. Swap the sample text for the cart's contents. Steps:

  1. When the cart is empty, show "Your cart is empty." in place of the cards and hide the
     pay button.

  2. Back button: go(paths.store(cart.store.id)). The card's header: StoreMono, the store's
     name and description.

  3. One list item per cart line (v-for)
     - The − and + buttons change that line's quantity (0 removes it).
     - The dish's name, then the names of the chosen options joined with ', '
       (look them up in the dish's option_groups by id).
     - money(unit_price x qty)

  4. Pickup only for now: placeOrder always saves type 'pickup'. The prototype's
     Self pickup / Peer delivery choice can come back once the backend handles delivery.

  5. The sums, the same rule as placeOrder:
     subtotal = add up unit_price x qty
     discount from the store's discount_type (hide the row when it's 0);
       the label is "Student discount (15%)" for a percentage, "Student discount" for dollars
     total = subtotal - discount, never below 0
     The server works out the real price; this is what the student expects to pay.

  6. "Pay $19.21": go(paths.pay) opens the payment page.
*/
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

    <!-- Step 1 -->
    <div v-if="cart.lines.length === 0" class="card">
      <div class="card-body">
        <p>Your cart is empty.</p>
        <button type="button" class="btn btn-brand" @click="go(paths.home)">Find food</button>
      </div>
    </div>

    <template v-else>
      <!-- Step 2 -->
      <button type="button" class="btn btn-sm btn-outline-secondary mb-3" @click="go(paths.store(cart.store.id))">← {{ cart.store.name }}</button>

      <div class="card mb-3">
        <div class="card-header bg-white d-flex align-items-center gap-2">
          <StoreMono :name="cart.store.name" :size="38" />
          <div>
            <div class="fw-bold">{{cart.store.name}}</div>
            <div class="small text-muted">{{cart.store.description}}</div>
          </div>
        </div>
        <!-- Step 3: one item per line in the cart -->
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

      <!-- Step 4 -->
      <div class="alert alert-light border">
        <b>🛍️ Pickup</b>
        <div class="small text-muted">Collect it at the counter when it's ready</div>
      </div>

      <!-- Step 5 -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between"><span>Subtotal</span><span>{{ money(cartSubtotal) }}</span></div>
          <div class="d-flex justify-content-between text-success fw-bold" v-if="cartDiscount > 0"><span>Student discount {{ cart.store.discount_type === 'percentage' ? `(${cart.store.discount_per}%)` : '' }}</span><span>-{{ money(cartDiscount) }}</span></div>
          <hr />
          <div class="d-flex justify-content-between fw-bold fs-5"><span>Total</span><span>{{ money(cartTotal) }}</span></div>
        </div>
      </div>

      <!-- Step 6 -->
      <div class="bottom-bar">
        <button type="button" class="btn btn-brand btn-lg w-100 shadow" @click="go(paths.pay)">Pay {{ money(cartTotal) }}</button>
      </div>
    </template>
  </div>
</template>
