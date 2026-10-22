<script setup>
// The delivery drop-off picker on checkout: a radio list of the nearest drop-off
// points plus a courier note field and the fallback hint.
//
// { d, m } (destination + metres away). Emits 'pick' with a destination id and
// 'note' with the typed note.
defineProps({
  drops: { type: Array, default: () => [] },
  // Currently-selected destination id.
  selected: { type: String, default: '' },
  // Current note text.
  note: { type: String, default: '' },
  // Delivery window in minutes (for the hint).
  windowMin: { type: Number, default: 10 },
})
defineEmits(['pick', 'note'])
</script>

<template>
  <div class="panel co-drop">
    <strong class="co-label">Deliver to</strong>
    <label v-for="x in drops" :key="x.d.id" class="drop" :class="{ on: selected === x.d.id }">
      <input
        type="radio"
        class="form-check-input"
        name="dropoff"
        :checked="selected === x.d.id"
        @change="$emit('pick', x.d.id)"
      >
      <span>{{ x.d.name }}</span><small>{{ x.m }} m away</small>
    </label>
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
.co-label {
  display: block;
  margin-bottom: 6px;
}
.drop {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 4px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
.drop + .drop {
  border-top: 1px solid var(--line);
}
.drop span {
  flex: 1;
}
.drop small {
  color: var(--muted);
  font-weight: 600;
}
.drop .form-check-input {
  margin: 0;
  flex: none;
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
