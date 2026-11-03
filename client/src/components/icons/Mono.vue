<script setup>
// A store's square icon: its logo when it has one (stores.logo_url), otherwise a
// coloured square with its initials. If the logo file can't load (e.g. it isn't
// in client/public yet), it falls back to the initials instead of a broken image.
import { computed, ref, watch } from 'vue'

const props = defineProps({ store: Object, size: { type: Number, default: 40 }, ring: Boolean })

const failed = ref(false)
watch(() => props.store.logo_url, () => { failed.value = false })
const showLogo = computed(() => !!props.store.logo_url && !failed.value)
</script>

<template>
  <span class="mono" :class="{ ring, 'has-logo': showLogo }"
    :style="{ width: size + 'px', height: size + 'px', background: showLogo ? '#fff' : store.color, fontSize: Math.round(size * 0.36) + 'px' }">
    <img v-if="showLogo" :src="store.logo_url" :alt="`${store.name} logo`" class="mono-logo" loading="lazy" @error="failed = true">
    <template v-else>{{ store.mono }}</template>
  </span>
</template>

<style scoped>
.mono.has-logo {
  position: relative;
  overflow: hidden;
}
/* thin edge so white logos don't melt into white cards */
.mono.has-logo::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(16, 24, 40, 0.1);
  pointer-events: none;
}
.mono-logo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
