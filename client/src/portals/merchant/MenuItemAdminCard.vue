<script setup>
import { computed, ref, watch } from 'vue'
import * as E from '@/utils/engine.js'

const props = defineProps({
  item: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  removing: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle-available', 'edit', 'remove'])

const confirming = ref(false)
watch(() => props.removing, (now, before) => { if (before && !now) confirming.value = false })

const groups = computed(() => (props.item.option_groups || []).length)
const cookMin = computed(() => Math.max(1, Math.round(props.item.cook_time_sec / 60)))
</script>

<template>
  <section class="card h-100" :class="{ 'sold-out': !item.available }">
    <img v-if="item.image_url" :src="item.image_url" class="card-img-top object-fit-cover" :alt="item.name">
    <div v-else class="card-img-top bg-body-tertiary d-flex align-items-center justify-content-center text-body-secondary">
      <i class="bi bi-image type-display" aria-hidden="true"></i>
    </div>
    <div class="card-body d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <h5 class="card-title fw-bold mb-1">{{ item.name }}</h5>
        <span class="fw-bold text-nowrap">{{ E.money(item.price) }}</span>
      </div>
      <span class="badge rounded-pill text-bg-light align-self-start mb-2">{{ item.category }}</span>
      <p v-if="item.description" class="card-text small mb-2">{{ item.description }}</p>
      <p class="card-text small text-body-secondary mt-auto mb-0">{{ groups ? groups + (groups === 1 ? ' option group' : ' option groups') : 'No options' }} · {{ cookMin }} min, batch of {{ item.max_at_once }}</p>
    </div>
    <div class="card-footer bg-transparent">
      <div v-if="confirming" class="d-flex align-items-center gap-2">
        <span class="small fw-bold me-auto">Remove this item?</span>
        <button type="button" class="btn btn-sm btn-danger" :disabled="removing" @click="emit('remove', item)">Remove</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="removing" @click="confirming = false">Cancel</button>
      </div>
      <div v-else class="d-flex align-items-center gap-2">
        <label class="form-check form-switch mb-0 small fw-bold text-nowrap me-auto">
          <input class="form-check-input" type="checkbox" role="switch" :checked="item.available" :disabled="busy" @change="emit('toggle-available', $event.target.checked)">
          <span class="form-check-label">{{ item.available ? 'Available' : 'Sold out' }}</span>
        </label>
        <button type="button" class="btn btn-sm btn-primary" :aria-label="'Edit ' + item.name" @click="emit('edit', item)"><i class="bi bi-pencil" aria-hidden="true"></i> Edit</button>
        <button type="button" class="btn btn-sm btn-outline-danger" :aria-label="'Remove ' + item.name" @click="confirming = true"><i class="bi bi-trash" aria-hidden="true"></i></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card {
  border-radius: 14px;
  overflow: hidden;
}
.card-img-top {
  height: 160px;
}
.card-title {
  font-size: var(--fs-subheading);
}
.sold-out .card-img-top {
  filter: grayscale(1);
  opacity: 0.6;
}
</style>
