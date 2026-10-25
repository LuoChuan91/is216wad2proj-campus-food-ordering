<script setup>
// The delivery drop-off picker on checkout: a searchable, scrollable radio list
// of drop-off points (sorted nearest-first by the parent) plus a courier note
// field and the fallback hint.
//
// { d, m } (destination + metres away). Emits 'pick' with a destination id and
// 'note' with the typed note.
import { ref, computed } from 'vue'

const props = defineProps({
  drops: { type: Array, default: () => [] },
  // Currently-selected destination id.
  selected: { type: String, default: '' },
  // Current note text.
  note: { type: String, default: '' },
  // Delivery window in minutes (for the hint).
  windowMin: { type: Number, default: 10 },
})
defineEmits(['pick', 'note'])

// Filter drop-offs by name (case-insensitive). Keeps the nearest-first order.
const query = ref('')
const shownDrops = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.drops
  return props.drops.filter((x) => String(x.d.name || '').toLowerCase().includes(q))
})
</script>

<template>
  <div class="panel co-drop">
    <strong class="co-label d-block mb-2">Deliver to</strong>
    <input
      class="form-control form-control-sm co-search"
      type="search"
      placeholder="Search drop-off points…"
      aria-label="Search drop-off points"
      v-model="query"
    >
    <div class="drop-list">
      <p v-if="!shownDrops.length" class="drop-empty">No drop-off points match “{{ query }}”.</p>
      <label v-for="x in shownDrops" :key="x.d.id" class="drop d-flex align-items-center gap-2" :class="{ on: selected === x.d.id }">
        <input
          type="radio"
          class="form-check-input m-0 flex-shrink-0"
          name="dropoff"
          :checked="selected === x.d.id"
          @change="$emit('pick', x.d.id)"
        >
        <span class="flex-grow-1">{{ x.d.name }}</span><small>{{ x.m }} m away</small>
      </label>
    </div>
    <input
      class="form-control form-control-sm co-note"
      maxlength="80"
      placeholder="Note for the courier (optional)"
      :value="note"
      @input="$emit('note', $event.target.value)"
    >
    <p class="hint">A student courier brings it to you. If nobody accepts within {{ windowMin }} min, it switches to pickup and the fee is waived.</p>
  </div>
</template>

<style scoped>
/* Delivery drop-off picker (moved from the global stylesheet). */
.co-search {
  margin-bottom: 6px;
  border-radius: 10px;
  font-size: 13px;
}
/* Fixed-height scroll so a long list of drop-off points never pushes the page;
   it scrolls inside this box instead. */
.drop-list {
  max-height: 11rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.drop-empty {
  margin: 8px 2px;
  color: var(--muted);
  font-size: 12.5px;
}
.drop {
  padding: 9px 4px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
.drop + .drop {
  border-top: 1px solid var(--line);
}
.drop small {
  color: var(--muted);
  font-weight: 600;
}
.co-note {
  margin-top: 8px;
  border-radius: 10px;
  font-size: 13px;
}
.hint {
  margin: 8px 0 0;
  color: var(--ink-2);
  font-size: 12px;
  background: var(--canvas);
  border-radius: 12px;
  padding: 8px 10px;
}
</style>
