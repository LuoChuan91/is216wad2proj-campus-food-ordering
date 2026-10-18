<script setup>
// Notification bell with an unread badge — FULL BOOTSTRAP control.
//
// Responsiveness and the open/close toggle are handled entirely by Bootstrap,
// with no useMediaQuery and no reactive `open` state:
//   >= md : a button wired to Bootstrap's offcanvas via data-bs-toggle /
//           data-bs-target. Bootstrap's JS bundle (imported in main.js) opens
//           and closes the panel. Hidden below md with d-none d-md-*.
//   <  md : a plain <RouterLink> to the full-screen /notifications page.
//           Hidden from md up with d-md-none.
//
// A CSS class cannot change what a click does, so instead of one button that
// behaves differently per breakpoint, we render TWO triggers and let Bootstrap
// display utilities show the right one. See answer.md §6.2.
//
// Self-contained: drop it into whatever navbar others build later.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications.js'
import NotificationPanel from '@/components/NotificationPanel.vue'

const store = useNotificationsStore()
const { items } = storeToRefs(store)

const unread = computed(() => items.value.filter((n) => !n.read).length)
const unreadLabel = computed(() => (unread.value > 99 ? '99+' : String(unread.value)))
</script>

<template>
  <div class="notification-bell">
    <button
      type="button"
      class="btn btn-link position-relative p-2 d-none d-md-inline-flex"
      aria-label="Notifications"
      data-test="bell-desktop"
      data-bs-toggle="offcanvas"
      data-bs-target="#notificationOffcanvas"
      aria-controls="notificationOffcanvas"
    >
      <i class="bi bi-bell fs-5" aria-hidden="true"></i>
      <span
        v-if="unread > 0"
        class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger"
        data-test="unread-badge"
      >
        {{ unreadLabel }}
        <span class="visually-hidden">unread notifications</span>
      </span>
    </button>

    <!-- Mobile (< md): a link to the full-screen page. -->
    <RouterLink
      to="/notifications"
      class="btn btn-link position-relative p-2 d-inline-flex d-md-none"
      aria-label="Notifications"
      data-test="bell-mobile"
    >
      <i class="bi bi-bell fs-5" aria-hidden="true"></i>
      <span
        v-if="unread > 0"
        class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger"
      >
        {{ unreadLabel }}
        <span class="visually-hidden">unread notifications</span>
      </span>
    </RouterLink>

    <!-- The offcanvas itself. Bootstrap's bundle (data-bs-*) opens/closes it and
         manages the backdrop; the width is responsive via --bs-offcanvas-width. -->
    <div
      id="notificationOffcanvas"
      class="offcanvas offcanvas-end"
      tabindex="-1"
      aria-labelledby="notificationOffcanvasLabel"
      style="--bs-offcanvas-width: min(90vw, 420px)"
      data-test="offcanvas"
    >
      <div class="offcanvas-header">
        <h5 id="notificationOffcanvasLabel" class="offcanvas-title">Notifications</h5>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="offcanvas"
          aria-label="Close"
        ></button>
      </div>
      <div class="offcanvas-body p-2 p-md-3">
        <NotificationPanel />
      </div>
    </div>
  </div>
</template>
