<script setup>
/*
  Student: payment. Payment is simulated, as in the proposal: no money moves, and the server
  saves a payment row with the order.

  The template below is the finished layout. Steps:

  1. The amount: the same total as checkout. The store's name from cart.store.

  2. Confirm payment
     - POST /api/orders with headers { 'Content-Type': 'application/json' } and body
         JSON.stringify({
           student_id: DEMO.studentId,
           items: cart.lines.map((line) => ({ menu_item_id: line.item.id, qty: line.qty, option_ids: line.option_ids })),
         })
     - While it's being sent: disable the buttons, and show the spinner with
       "Processing payment" (the commented-out line next to the button).
     - If the response isn't ok, read its JSON and show `error` in the red alert.
       Try it: pause the store in Supabase (stores.is_open = false), and the server answers
       "Sakura Bento House is not opened".

  3. If it's ok (201), keep the returned order and show the "Payment successful" card instead.
     It has order.id and order.payment ({ amount, reference }). Then empty the cart.

  4. Payment successful: money(order.payment.amount) paid to the store, orderCode(order.id),
     order.payment.reference. "Back to stores" is already wired.
*/
import { ref, computed } from 'vue'
import { DEMO } from '../demo'
import { go, paths, closeSheet } from '../router'
import { money, orderCode } from '../utils/format'
import { cart, setLineQty, cartSubtotal, cartDiscount, cartTotal, clearCart } from '../cart'
import axios from 'axios'

const sending = ref(false)      
const errorMessage = ref('')     
const order = ref(null) 
const store = ref()

async function postPayment() {
  sending.value = true
  errorMessage.value = ''
  try {
    let response = await axios.post('/api/orders', {
      student_id: DEMO.studentId,
      items: cart.value.lines.map(line => ({ menu_item_id: line.item.id, qty: line.qty, option_ids: line.option_ids}))
    })
    store.value = cart.value.store.name
    order.value = response.data
    clearCart()
  } catch (err) {
    if (err.response) {
      errorMessage.value = err.response.data.error
    } else {
      errorMessage.value = "Couldn't reach the server"
    }
      
  } finally {
    sending.value = false
  }
}

</script>

<template>
  <div class="page-narrow">
    <!-- Steps 3 and 4: after the order is placed, show this instead -->
    <div v-if="!errorMessage && order" class="card text-center">
      <div class="card-body py-4">
        <div class="display-4 text-success">✓</div>
        <h1 class="h4 fw-bold">Payment successful</h1>
        <p class="text-muted">{{ money(order.payment.amount) }} paid to {{ store }}</p>
        <table class="table table-sm text-start mx-auto order-ref">
          <tbody>
            <tr><th>Order</th><td class="font-monospace">{{ orderCode(order.id) }}</td></tr>
            <tr><th>Reference</th><td class="font-monospace">{{ order.payment.reference }}</td></tr>
          </tbody>
        </table>
        <button type="button" class="btn btn-brand btn-lg w-100" @click="go(paths.home)">Back to stores</button>
      </div>
    </div>

    <div v-else class="card">
      <div class="card-body">
        <h1 class="h4 fw-bold">Payment</h1>
        <p class="text-muted">Simulated for this prototype.</p>

        <!-- Step 1 -->
        <div class="bg-light rounded text-center py-3 mb-3">
          <div class="text-muted small">You pay {{ cart.store.name }}</div>
          <div class="display-6 fw-bold">{{ money(cartTotal) }}</div>
        </div>
        <div class="border border-warning rounded p-3 mb-3 d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-bold">💳 Campus wallet</div>
            <div class="small text-muted">Sample payment method</div>
          </div>
          <span class="badge text-bg-light border">Simulated</span>
        </div>

        <!-- Step 2: the server's error, when there is one -->
        <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>

        <button type="button" class="btn btn-brand btn-lg w-100" @click="postPayment" :disabled="sending">Confirm payment</button>
        <span class="spinner-border spinner-border-sm me-2" v-if="sending"></span>{{ sending ? 'Processing payment' : '' }}
          
        <button type="button" class="btn btn-link w-100 mt-2" @click="closeSheet" :disabled="sending">Back to checkout</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-ref {
  max-width: 320px;
}
</style>
