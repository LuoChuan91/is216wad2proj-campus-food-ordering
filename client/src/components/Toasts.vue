<script setup>
// Pop-up notifications for whoever is signed in to this tab (click to dismiss)
import { S, A } from '@/stores/compat.js'
import AppMark from './AppMark.vue'
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <button v-for="t in S.toasts" :key="t.id" type="button" class="toast-card" :class="'tone-' + t.tone" @click="A.dismissToast(t.id)">
        <AppMark :size="26" />
        <span class="toast-text"><strong>{{ t.title }}</strong><span>{{ t.body }}</span></span>
        <small>now</small>
      </button>
    </TransitionGroup>
  </div>
</template>
