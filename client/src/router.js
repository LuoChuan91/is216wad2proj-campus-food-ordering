// A tiny router: the part of the address after # decides which screen shows.
//   #/student                              the store list
//   #/student/store/<store id>             a store's page
//   #/student/store/<store id>/item/<id>   a dish: choose its options (ItemSheet.vue)
//   #/student/checkout                     checkout
//   #/student/checkout/pay                 payment (PaySheet.vue)
// The browser's back button and reloading both work, because the screen lives in the address.
// Once there are many more screens, switch to vue-router.
import { reactive } from 'vue'

// What to show now. App.vue reads this; pages can too.
export const route = reactive({ page: null, sheet: null, storeId: null, itemId: null })

// The addresses, so pages don't build them by hand: go(paths.store(store.id))
export const paths = {
  home: '#/student',
  store: (storeId) => `#/student/store/${storeId}`,
  item: (storeId, itemId) => `#/student/store/${storeId}/item/${itemId}`,
  checkout: '#/student/checkout',
  pay: '#/student/checkout/pay',
}

export const go = (hash) => {
  window.location.hash = hash
}

// Leave the dish or payment page: back to the store page, or back to checkout
export const closeSheet = () => go(route.sheet === 'item' ? paths.store(route.storeId) : paths.checkout)

function read() {
  const [section, page, id, sub, subId] = window.location.hash.replace(/^#\/?/, '').split('/')
  Object.assign(route, { page: null, sheet: null, storeId: null, itemId: null })
  if (section !== 'student') return
  if (page === 'store' && id) {
    Object.assign(route, { page: 'store', storeId: id })
    if (sub === 'item' && subId) Object.assign(route, { sheet: 'item', itemId: subId })
  } else if (page === 'checkout') {
    route.page = 'checkout'
    if (id === 'pay') route.sheet = 'pay'
  }
}

read()
window.addEventListener('hashchange', read)
