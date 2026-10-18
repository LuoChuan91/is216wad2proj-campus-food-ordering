<script setup>
// Stacked in-app toasts, bottom-left (Bootstrap toast styling).
//
// Reads the active toast queue from the notifications store. Each toast auto
// dismisses after `duration` ms, or when the user clicks the close button.
// Dismissing removes it from the toast queue but keeps it in notification
// history (see the store).
import { watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications.js'

const props = defineProps({
  duration: { type: Number, default: 6000 },
})

const store = useNotificationsStore()
const { toasts } = storeToRefs(store)

// Track auto-dismiss timers so we can clear them if a toast is closed early or
// the component unmounts.
const timers = new Map()

function scheduleDismiss(id) {
  if (timers.has(id)) return
  const t = setTimeout(() => dismiss(id), props.duration)
  timers.set(id, t)
}

function dismiss(id) {
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
  store.dismissToast(id)
}

// Give every newly-arrived toast an auto-dismiss timer.
watch(
  toasts,
  (list) => {
    for (const t of list) scheduleDismiss(t.id)
  },
  { deep: true, immediate: true }
)

onBeforeUnmount(() => {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
})
</script>

<template>
  <!-- position-fixed bottom-0 start-0 => bottom-left corner -->
  <div
    class="toast-container position-fixed bottom-0 start-0 p-3"
    style="z-index: 1090"
    aria-live="polite"
    aria-atomic="true"
  >
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast show mb-2"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div class="toast-header">
        <span
          class="rounded me-2"
          :class="`bg-${t.variant}`"
          style="display: inline-block; width: 0.75rem; height: 0.75rem"
          aria-hidden="true"
        ></span>
        <strong class="me-auto">{{ t.title }}</strong>
        <button
          type="button"
          class="btn-close"
          aria-label="Close"
          @click="dismiss(t.id)"
        ></button>
      </div>
      <div class="toast-body">{{ t.body }}</div>
    </div>
  </div>
</template>
