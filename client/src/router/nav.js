// A tiny seam between the ui-store nav actions and vue-router.
//
// The nav actions (setTab/openStore/…) call go()/replace() here instead of
// importing the router directly. main.js attaches the real router with
// setRouter(router) at start-up. Until then — and in unit tests, which create a
// bare Pinia with no router — go()/replace() are harmless no-ops, so the actions
// still mutate ui-store state exactly as the prototype did and every existing test
// keeps passing without a router.
//
// This also keeps the store free of a static router import (no import cycle:
// router -> session/catalog stores -> ... ; the store -> nav.js has no store deps).
let _router = null

// Where each role lands after sign-in.
export const HOME = { student: '/student/explore', merchant: '/merchant', admin: '/admin' }

export function setRouter(router) {
  _router = router
}

// Push a target (string path or route location). Swallows the duplicated-navigation
// rejection vue-router throws when pushing the route you're already on.
export function go(to) {
  if (!_router) return
  const cur = _router.currentRoute.value
  const path = typeof to === 'string' ? to : null
  if (path && cur.fullPath === path) return
  Promise.resolve(_router.push(to)).catch(() => {})
}

export function replace(to) {
  if (!_router) return
  Promise.resolve(_router.replace(to)).catch(() => {})
}

// For tests / teardown.
export function _getRouter() {
  return _router
}
