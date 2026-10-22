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
