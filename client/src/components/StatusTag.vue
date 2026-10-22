<script setup>
// A small status/label tag with a tone (ok / muted / info / brand / warn).
// Replaces the repeated <span class="tag ..."> markup across orders, deliver,
// admin stores and the store page. No visual change: it renders the exact same
// classes the prototype's app.css styles (tag + tone, optional chip variant).
defineProps({
  // The visual tone -> maps to app.css classes (ok, muted, info, brand, warn).
  tone: { type: String, default: '' },
  // When true, render as a pill chip (class "chip") instead of a "tag".
  chip: { type: Boolean, default: false },
  // Optional leading dot (used by the store page's open/closed chip).
  dot: { type: Boolean, default: false },
})
</script>

<template>
  <span :class="[chip ? 'chip' : 'tag', tone]"><i v-if="dot" class="dot"></i><slot /></span>
</template>
