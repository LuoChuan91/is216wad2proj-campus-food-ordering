// "Where is my rider", both ends: useRiderLocation polls the courier's last GPS; 
// useCourierBeacon shares the courier's phone GPS to every in-progress job while they deliver.
import { ref, watch, onBeforeUnmount, toValue } from 'vue'
import { api } from '@/services/api.js'
import { config as cfg } from '@/config/index.js'

export function useRiderLocation(deliveryId, active, { fetchLocation = api.riderLocation, pollMs = cfg.pollMs } = {}) {
  const fix = ref(null)
  let timer = null

  async function load() {
    const id = toValue(deliveryId)
    try {
      const res = await fetchLocation(id)
      if (id === toValue(deliveryId)) fix.value = res.location
    } catch (e) {
      console.warn('[rider] location poll failed, keeping the last fix:', e.message)
    }
  }
  function stop() { clearInterval(timer); timer = null }

  watch(() => [toValue(deliveryId), toValue(active)], ([id, on]) => {
    stop()
    if (!id || !on) { fix.value = null; return }
    load()
    timer = setInterval(load, pollMs)
  }, { immediate: true })
  onBeforeUnmount(stop)

  return { fix }
}

const SHARE_EVERY_MS = 5000

export function useCourierBeacon(jobIds, courierId, {
  share = api.shareLocation,
  geo = typeof navigator !== 'undefined' ? navigator.geolocation : null,
} = {}) {
  // off: no job in progress | waiting: asked for GPS | on: sharing | denied | unsupported
  const state = ref('off')
  let watchId = null, timer = null, last = null

  function send() {
    if (!last) return
    for (const id of toValue(jobIds)) {
      share(id, toValue(courierId), last).catch((e) => console.warn('[rider] sharing location failed:', e.message))
    }
  }
  function onFix(p) {
    const first = !last
    last = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }
    state.value = 'on'
    if (first) send()
  }
  function onError(e) { state.value = e.code === 1 ? 'denied' : 'waiting' }
  function stop() {
    if (watchId != null) geo.clearWatch(watchId)
    clearInterval(timer)
    watchId = timer = last = null
  }

  watch(() => toValue(jobIds).length > 0, (busy) => {
    if (!busy) { stop(); state.value = 'off'; return }
    if (!geo) { state.value = 'unsupported'; return }
    if (watchId != null) return
    state.value = 'waiting'
    watchId = geo.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 })
    // resend on a timer
    timer = setInterval(send, SHARE_EVERY_MS)
  }, { immediate: true })
  onBeforeUnmount(stop)

  return { state }
}
