<script setup>
// The tinted hero at the top of a store page: a back button, the store's mono
// badge, its name and the venue/unit line.
//
// Extracted from views/student/StoreView.vue. The back action is emitted so the
// view keeps owning navigation (A.back()). Markup and the --tint style var are
// unchanged.
import { computed } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import Mono from '@/components/icons/Mono.vue'

const props = defineProps({
  store: { type: Object, required: true },
  // Already-shortened venue name (or '').
  venueName: { type: String, default: '' },
})
defineEmits(['back'])

const photo = computed(() => {
  const url = props.store.image_url
  return url && /^https?:\/\//.test(url) ? `url("${encodeURI(url).replace(/"/g, '%22')}")` : null
})
</script>

<template>
  <div class="store-hero" :class="{ 'has-photo': photo }" :style="{ '--tint': store.color, '--photo': photo }">
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
.store-hero.has-photo {
  height: 200px;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.25) 45%, rgba(0, 0, 0, 0.7) 100%),
    var(--photo) center / cover no-repeat,
    linear-gradient(160deg, var(--tint) 0%, color-mix(in srgb, var(--tint) 70%, #000) 100%);
}
.store-hero.has-photo h2,
.store-hero.has-photo p {
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}
.hero-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.store-hero h2 {
  color: #fff;
  font-size: var(--fs-title);
  font-weight: 800;
  margin: 0;
}
.store-hero p {
  margin: 2px 0 0;
  opacity: 0.88;
  font-size: var(--fs-desc);
}
</style>
