<script setup>
// Stacked in-app toasts, bottom-left.
//
// Reads the active toast queue from the notifications store. Each toast auto
// dismisses after `duration` ms, or when the user clicks the close button.
// Dismissing removes it from the toast queue but keeps it in notification
// history (see the store).
import { watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications.js'
import AppMark from '@/components/icons/AppMark.vue'

const props = defineProps({
  // toast last for 3min before auto dismissed
  duration: { type: Number, default: 180000 },
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
  <!-- bottom-right corner -->
  <div
    class="toast-container position-fixed bottom-0 end-0 p-3"
    style="z-index: 1090"
    aria-live="polite"
    aria-atomic="true"
  >
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast-card"
        :class="`tone-${t.variant}`"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <span class="toast-mark" aria-hidden="true"><AppMark :size="26" /></span>
        <span class="toast-text">
          <strong>{{ t.title }}</strong>
          <span>{{ t.body }}</span>
        </span>
        <button
          type="button"
          class="toast-x"
          aria-label="Close"
          @click="dismiss(t.id)"
        >&times;</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Prototype toast-card look: a rounded white card with the app mark, a bold
   title and a muted body, a soft shadow and a left tone accent. Matches the
   overall app UI (map cards, store cards) rather than the plain Bootstrap toast. */
.toast-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(360px, calc(100vw - 24px));
}
.toast-card {
  position: relative;
  display: grid;
  grid-template-columns: 26px 1fr auto;
  gap: 10px;
  align-items: start;
  width: 100%;
  text-align: left;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.98);
  border-radius: 16px;
  padding: 11px 13px;
  border-left: 4px solid var(--brand);
  box-shadow:
    0 12px 34px rgba(20, 24, 40, 0.24),
    0 0 0 1px rgba(20, 24, 40, 0.06);
  font-family: var(--font-ui);
  font-size: 13px;
  line-height: 1.3;
  pointer-events: auto;
}
/* Tone accent (left border) per Bootstrap-style variant. */
.toast-card.tone-success { border-left-color: var(--ok, #1aa46f); }
.toast-card.tone-info { border-left-color: var(--info, #3c74e8); }
.toast-card.tone-warning { border-left-color: #e5a019; }
.toast-card.tone-danger { border-left-color: var(--late, #d9472b); }
.toast-card.tone-secondary { border-left-color: var(--brand); }
.toast-mark {
  display: inline-flex;
  margin-top: 1px;
}
.toast-text strong {
  display: block;
  font-size: 13.5px;
}
.toast-text span {
  color: var(--ink-2);
}
.toast-x {
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
.toast-x:hover { color: var(--ink); }

/* Enter/leave animation. */
.toast-enter-active,
.toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from { opacity: 0; transform: translateY(8px); }
.toast-leave-to { opacity: 0; transform: translateX(16px); }
</style>
