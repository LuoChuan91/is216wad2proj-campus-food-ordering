<script setup>
// Shared notification list UI. Used both by the full-screen NotificationsView
// (mobile) and inside the offcanvas panel (desktop). Reads history from the
// notifications store.
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications.js'

const store = useNotificationsStore()
const { items } = storeToRefs(store)

function formatTime(at) {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}
</script>

<template>
  <div class="notification-panel">
    <div
      v-if="items.length === 0"
      class="text-center text-muted py-4 py-md-5"
      data-test="empty"
    >
      <i class="bi bi-bell-slash fs-3 d-block mb-2" aria-hidden="true"></i>
      No notifications yet.
    </div>

    <ul v-else class="list-group list-group-flush">
      <li
        v-for="n in items"
        :key="n.id"
        class="list-group-item d-flex gap-2 gap-md-3"
        :class="{ 'bg-body-tertiary': !n.read }"
        data-test="notification"
      >
        <span
          class="notif-dot rounded-circle flex-shrink-0 mt-1"
          :class="`bg-${n.variant}`"
          aria-hidden="true"
        ></span>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start">
            <strong class="fs-6">{{ n.title }}</strong>
            <small class="text-muted ms-2 flex-shrink-0">{{ formatTime(n.at) }}</small>
          </div>
          <div class="small">{{ n.body }}</div>
          <button
            v-if="!n.read"
            type="button"
            class="btn btn-link btn-sm px-0"
            @click="store.markRead(n.id)"
          >
            Mark as read
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Bootstrap has no 12px square utility, so the status dot's fixed size lives
   here as a small scoped rule (colour still comes from a Bootstrap bg-* class). */
.notif-dot {
  width: 0.6rem;
  height: 0.6rem;
  display: inline-block;
}
</style>
