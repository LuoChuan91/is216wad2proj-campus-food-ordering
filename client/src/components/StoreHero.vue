<script setup>
// The tinted hero at the top of a store page: a back button, the store's mono
// badge, its name and the venue/unit line.
//
// Extracted from views/student/StoreView.vue. The back action is emitted so the
// view keeps owning navigation (A.back()). Markup and the --tint style var are
// unchanged.
import Icon from '@/components/icons/Icon.vue'
import Mono from '@/components/icons/Mono.vue'

defineProps({
  store: { type: Object, required: true },
  // Already-shortened venue name (or '').
  venueName: { type: String, default: '' },
})
defineEmits(['back'])
</script>

<template>
  <div class="store-hero" :style="{ '--tint': store.color }">
    <button class="icon-btn glass" aria-label="Back" @click="$emit('back')"><Icon name="back" :size="20" /></button>
    <div class="hero-row container px-0">
      <Mono :store="store" :size="56" ring />
      <div><h2>{{ store.name }}</h2><p>{{ venueName }} · {{ store.unit_no }}</p></div>
    </div>
  </div>
</template>

<style scoped>
/* Tinted store hero (moved from the global prototype stylesheet). Uses the
   --tint custom property set inline from the store's colour. */
.store-hero {
  position: relative;
  flex: none;
  height: 150px;
  padding: 0 16px 16px;
  display: flex;
  align-items: flex-end;
  color: #fff;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--tint) 88%, #fff) 0%,
    var(--tint) 55%,
    color-mix(in srgb, var(--tint) 70%, #000) 100%
  );
}
.hero-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.store-hero h2 {
  color: #fff;
  font-size: 22px;
  font-weight: 800;
  margin: 0;
}
.store-hero p {
  margin: 2px 0 0;
  opacity: 0.88;
  font-size: 13px;
}
</style>
