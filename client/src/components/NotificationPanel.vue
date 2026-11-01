<script setup>
// Shared notification list UI. Used both by the full-screen NotificationsView
// (mobile) and inside the offcanvas panel (desktop). Reads history from the
// notifications store.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications.js'

const store = useNotificationsStore()
const { items } = storeToRefs(store)

const hasUnread = computed(() => items.value.some(n => !n.read))

function formatTime(at) {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}
</script>

<template>
  <div class="notification-panel">
    <div v-if="items.length === 0" class="text-center text-muted py-4 py-md-5" data-test="empty">
      <i class="bi bi-bell-slash type-display d-block mb-2" aria-hidden="true"></i>
      No notifications yet.
    </div>

    <ul v-else class="notif-list">
      <!-- Mark all as read header -->
      <div v-if="hasUnread" class="notif-header">
        <button type="button" class="btn btn-link btn-sm px-0 notif-read-all" @click="store.markAllRead()">
          Mark all as read
        </button>
      </div>

      <li v-for="n in items" :key="n.id" class="notif-row" :class="{ unread: !n.read }" data-test="notification">
        <span class="notif-dot rounded-circle flex-shrink-0 mt-1" :class="`bg-${n.variant}`" aria-hidden="true"></span>
        <div class="flex-grow-1">
          <div class="notif-top">
            <strong class="notif-title">{{ n.title }}</strong>
            <small class="notif-time">{{ formatTime(n.at) }}</small>
          </div>
          <div class="notif-body">{{ n.body }}</div>
          <button v-if="!n.read" type="button" class="btn btn-link btn-sm px-0 notif-read"
            @click="store.markRead(n.id)">
            Mark as read
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Map tooltip-card look: rounded rows on a paper surface, a tone dot, a bold
   title with a muted body + timestamp — matching the app's map/store cards. */
.notif-dot {
  width: 0.6rem;
  height: 0.6rem;
  display: inline-block;
}

/* Fixed, scrollable list: the panel never grows taller than this, however many
   notifications there are — the list scrolls instead. */
.notif-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(60vh, 24rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.notif-row {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--paper);
  border: 1px solid var(--line);
  font-family: var(--font-ui);
}

.notif-row.unread {
  background: var(--canvas);
  border-color: var(--brand);
}

.notif-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.notif-title {
  font-size: var(--fs-desc);
  color: var(--ink);
}

.notif-time {
  color: var(--muted);
  font-size: var(--fs-caption);
  flex-shrink: 0;
}

.notif-body {
  font-size: var(--fs-desc);
  color: var(--ink-2);
  margin-top: 1px;
}

.notif-read {
  font-size: var(--fs-caption);
  text-decoration: none;
  color: var(--brand);
}
</style>
