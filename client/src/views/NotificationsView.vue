<script setup>
// Full-page notifications list (the realtime notifications feature's full-screen
// surface). NotificationBell links here on < md; on >= md the bell opens its own
// offcanvas. Registered as the `/notifications` route so the link stays wired.
//   < md : fills the viewport height (minus any nav/header/footer) so it feels
//          like a dedicated screen on mobile.
//   >= md: sizes to its content (the bell's offcanvas is the primary desktop
//          surface; this page is still reachable directly).
// Responsiveness is driven by Bootstrap utility classes; the only custom rule is
// releasing the full-height constraint at >= md (Bootstrap has no stock
// `min-vh-md-auto`).
import NotificationPanel from '@/components/NotificationPanel.vue'
</script>

<template>
  <main class="notifications-view container py-3 py-md-4 d-flex flex-column min-vh-100">
    <h1 class="h5 mb-3">Notifications</h1>
    <div class="flex-grow-1 overflow-auto">
      <NotificationPanel />
    </div>
  </main>
</template>

<style scoped>
/* Bootstrap has min-vh-100 but no responsive min-vh-md-auto, so this single
   rule releases the full-height constraint from the md breakpoint up. */
@media (min-width: 768px) {
  .notifications-view {
    min-height: auto !important;
  }
}
</style>
