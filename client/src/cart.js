
import { ref, computed } from 'vue'

export const cart = ref({
  store: null, // the store these dishes are from (the object from GET /api/stores/:id)
  lines: [], // one per dish added, e.g. { item, qty, option_ids, unit_price }
})

export const cartSubtotal = computed(() => {
  let subtotal = 0
  for (let line of cart.value.lines) {
    subtotal += line.qty * line.unit_price
  }
  return subtotal
})

export const cartDiscount = computed(() => {
  if (!cart.value.store) return 0
  if (cart.value.store.discount_type === 'percentage') {
    return Math.round(cart.value.store.discount_per * cartSubtotal.value / 100 * 100) / 100
  } else if (cart.value.store.discount_type === 'dollar') {
    return cart.value.store.discount_dol
  }
  return 0
})

export const cartTotal = computed(() => {
  return Math.max(0, cartSubtotal.value - cartDiscount.value)
})

export function addToCart(store, item, qty, optionIds, unitPrice) {
  if (!cart.value.store || cart.value.store.id !== store.id) {
    cart.value.store = store
    cart.value.lines = []
  }
  cart.value.lines.push({ item: item, qty: qty, option_ids: optionIds, unit_price: unitPrice})
}

export function setLineQty(index, qty) {
  if (qty <= 0) {
    cart.value.lines.splice(index,1)
  } else {
    cart.value.lines[index].qty = qty
  }
}

export function clearCart() {
  cart.value.store = null
  cart.value.lines = []
}
