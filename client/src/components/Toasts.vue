<script setup>
// Pop-up notifications for whoever is signed in to this tab (click to dismiss)
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import AppMark from './AppMark.vue'

const ui = useUiStore()
const { toasts } = storeToRefs(ui)
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <button v-for="t in toasts" :key="t.id" type="button" class="toast-card" :class="'tone-' + t.tone" @click="ui.dismissToast(t.id)">
        <AppMark :size="26" />
        <span class="toast-text"><strong>{{ t.title }}</strong><span>{{ t.body }}</span></span>
        <small>now</small>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Pop-up toast stack (moved from the global stylesheet). The toast-enter/leave/
   move <TransitionGroup> classes stay global (Vue injects them, scoping breaks). */
.toasts {
  position: fixed;
  grid-auto-rows: min-content;
  z-index: 80;
  top: calc(var(--nav-h) + 10px);
  right: 14px;
  width: min(360px, calc(100vw - 28px));
  display: grid;
  gap: 8px;
  pointer-events: none;
}
.toast-card {
  pointer-events: auto;
  display: grid;
  grid-template-columns: 26px 1fr auto;
  gap: 10px;
  align-items: start;
  width: 100%;
  text-align: left;
  border: 0;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.97);
  border-radius: 18px;
  padding: 11px 13px;
  box-shadow:
    0 12px 34px rgba(20, 24, 40, 0.24),
    0 0 0 1px rgba(20, 24, 40, 0.06);
  font-family: var(--font-ui);
  font-size: 13px;
  line-height: 1.3;
  cursor: pointer;
}
.toast-text strong {
  display: block;
  font-size: 13.5px;
}
.toast-text span {
  color: var(--ink-2);
}
.toast-card small {
  color: var(--muted);
  font-size: 11.5px;
}
</style>
