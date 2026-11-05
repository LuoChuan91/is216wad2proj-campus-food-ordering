<script setup>
import { computed } from 'vue'
import * as E from '@/utils/engine.js'
import Icon from '@/components/icons/Icon.vue'
import StatusTag from '@/components/StatusTag.vue'

const props = defineProps({
  item: { type: Object, required: true },
  canAdd: { type: Boolean, default: true },
})
defineEmits(['open'])

const addable = computed(() => props.item.available && props.canAdd)
const customisable = computed(() => (props.item.option_groups || []).length > 0)
</script>

<template>
  <button class="menu-item card w-100 h-100 text-start p-0" :class="{ 'sold-out': !item.available }" :disabled="!addable" @click="$emit('open', item.id)">
    <span class="row g-0 w-100 h-100 flex-md-column flex-nowrap">
      <span class="col-4 col-md-12 d-block">
        <img v-if="item.image_url" :src="item.image_url" class="mi-img d-block w-100 h-100 object-fit-cover" :alt="item.name">
        <span v-else class="mi-img w-100 h-100 bg-body-tertiary d-flex align-items-center justify-content-center text-body-secondary"><i class="bi bi-image type-display" aria-hidden="true"></i></span>
      </span>
      <span class="col-8 col-md-12 d-flex align-items-center flex-grow-1">
        <span class="card-body d-flex flex-column h-100 overflow-hidden">
          <strong class="card-title mb-1">{{ item.name }}</strong>
          <small v-if="item.description" class="card-text mi-desc mb-2">{{ item.description }}</small>
          <span class="d-flex align-items-end justify-content-between gap-2 mt-auto">
            <span class="d-flex align-items-center flex-wrap gap-2"><b class="mi-price">{{ E.money(item.price) }}</b><StatusTag v-if="customisable">Customisable</StatusTag><StatusTag v-if="!item.available" tone="muted">Sold out</StatusTag></span>
            <span v-if="addable" class="mi-add d-none d-md-flex align-items-center justify-content-center flex-shrink-0 rounded-circle"><Icon name="plus" :size="18" :stroke="2.4" /></span>
          </span>
        </span>
        <span v-if="addable" class="mi-add d-flex d-md-none align-items-center justify-content-center flex-shrink-0 rounded-circle me-3" aria-hidden="true"><Icon name="plus" :size="18" :stroke="2.4" /></span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.menu-item {
  color: inherit;
  border-radius: 14px;
  overflow: hidden;
  transition: box-shadow 0.15s;
}
.menu-item:not(:disabled):hover {
  box-shadow: 0 6px 18px rgba(24, 27, 36, 0.1);
}
.menu-item:disabled {
  opacity: 1;
}
.mi-img {
  min-height: 112px;
}
@media (min-width: 768px) {
  .mi-img {
    height: 150px !important;
    min-height: 0;
  }
}
.card-title {
  font-size: var(--fs-subheading);
}
.mi-desc {
  color: var(--muted);
  font-size: var(--fs-desc);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mi-price {
  font-size: var(--fs-subheading);
}
.sold-out {
  opacity: 0.55;
}
.sold-out .mi-img {
  filter: grayscale(1);
}
.mi-add {
  width: 34px;
  height: 34px;
  background: var(--brand);
  color: #fff;
  box-shadow: 0 4px 10px rgba(229, 81, 45, 0.35);
}
</style>
