// Auth identity store — WHO is signed in, reactively.
//
// This holds just enough for the realtime layer to target the right channel
// (user:<id>). It is the READ side of auth: the session store is the single
// source of truth for the signed-in id and writes it here through setUserId()
// (see stores/session.js signIn/signOut). authService.js is the WRITE side
// (sign-in/out/reset), and its callers hand the authenticated user off to
// session.signIn(), which in turn updates this store — so the chain is
//
//     authService.signIn()  ->  session.signIn()  ->  auth.setUserId()
//
// No watch, no bridge: session pushes the id here directly whenever it changes.
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const userId = ref(null)
  const ready = ref(false) // true once the session has been resolved at least once

  /**
   * Set (or clear) the current user id. Called by the session store on
   * signIn / signOut / restoreSession. Passing null clears it (sign-out).
   * @param {string|null} id
   */
  function setUserId(id) {
    userId.value = id ?? null
    ready.value = true
  }

  return { userId, ready, setUserId }
})
