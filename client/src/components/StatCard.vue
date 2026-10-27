<script setup>
// One header statistic block (label on top, value below).
//
// Extracted from the repeated <div class="m-stat"><small>..</small><b>..</b></div>
// markup in the merchant and admin portal headers. An optional `cap` modifier and
// `title` tooltip are passed through to match the prototype exactly (e.g. the
// merchant's "Cooks at once" and "Updates: Live/Polling" cells).
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  // Adds the "cap" modifier class (merchant's capacity cell).
  cap: { type: Boolean, default: false },
  // Tooltip text.
  title: { type: String, default: '' },
})
</script>

<template>
  <div class="m-stat d-flex flex-column align-items-start align-items-md-end" :class="{ cap }" :title="title || undefined">
    <small>{{ label }}</small>
    <b><slot>{{ value }}</slot></b>
  </div>
</template>

<style scoped>
.m-stat small {
  color: var(--muted);
  font-size: var(--fs-micro);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.m-stat b {
  font-size: var(--fs-heading);
  font-variant-numeric: tabular-nums;
}
</style>
