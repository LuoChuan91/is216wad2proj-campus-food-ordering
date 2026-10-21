<script setup>
// App logo: a bowl with steam
defineProps({ size: { type: [Number, String], default: 28 } })
</script>

<template>
  <svg class="appmark" :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#e5512d" />
    <path d="M6.5 15.5h19a9.5 9.5 0 0 1-19 0z" fill="#fff" />
    <path d="M11.5 6.5c-1.3 1.7 1.3 2.7 0 4.6M16 6.5c-1.3 1.7 1.3 2.7 0 4.6M20.5 6.5c-1.3 1.7 1.3 2.7 0 4.6" stroke="#fff" stroke-width="1.9" stroke-linecap="round" fill="none" />
  </svg>
</template>
