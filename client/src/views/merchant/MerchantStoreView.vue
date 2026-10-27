<script setup>
import { computed, inject, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useMerchantStore } from '@/stores/merchant.js'

const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']]
const URL_RE = /^https?:\/\/\S+$/

const ui = useUiStore()
const orders = useOrdersStore()
const merchant = useMerchantStore()
const { busy } = storeToRefs(ui)
const store = inject('merchantStore')

const draft = reactive({ name: '', description: '', image_url: '', hours: {} })
const tried = ref(false)
const saving = ref(false)
const status = ref({ kind: '', text: '' })

function reset(s) {
  draft.name = s.name || ''
  draft.description = s.description || ''
  draft.image_url = s.image_url || ''
  for (const [d] of DAYS) {
    const r = (s.open_hours || {})[d]
    const range = r && r.length ? (Array.isArray(r[0]) ? r[0] : r) : null
    draft.hours[d] = { open: !!range, from: range ? range[0].slice(0, 5) : '11:00', to: range ? range[1].slice(0, 5) : '20:00' }
  }
  tried.value = false
  status.value = { kind: '', text: '' }
}
watch(() => store.value && store.value.id, () => store.value && reset(store.value), { immediate: true })

const errors = computed(() => {
  const e = {}
  if (!draft.name.trim()) e.name = 'Store name is required.'
  else if (draft.name.trim().length > 80) e.name = 'Keep the name to 80 characters or fewer.'
  if (draft.description.length > 500) e.description = 'Keep the description to 500 characters or fewer.'
  if (draft.image_url && !URL_RE.test(draft.image_url.trim())) e.image_url = 'Use a full link starting with http:// or https://.'
  for (const [d, label] of DAYS) {
    const h = draft.hours[d]
    if (h.open && (!h.from || !h.to)) e[d] = `Set both times for ${label}.`
    else if (h.open && h.from >= h.to) e[d] = `${label}: opening time must be before closing time.`
  }
  return e
})
const invalid = (k) => tried.value && errors.value[k]
const previewUrl = computed(() => (URL_RE.test(draft.image_url.trim()) ? draft.image_url.trim() : ''))

function copyMonday() {
  const mon = draft.hours.mon
  for (const [d] of DAYS) draft.hours[d] = { ...mon }
}

async function save() {
  tried.value = true
  status.value = { kind: '', text: '' }
  if (Object.keys(errors.value).length) {
    status.value = { kind: 'danger', text: 'Please fix the highlighted fields.' }
    return
  }
  const open_hours = {}
  for (const [d] of DAYS) if (draft.hours[d].open) open_hours[d] = [draft.hours[d].from, draft.hours[d].to]
  saving.value = true
  try {
    const saved = await merchant.saveStore(store.value.id, {
      name: draft.name.trim(),
      description: draft.description.trim(),
      image_url: draft.image_url.trim(),
      open_hours,
    })
    reset(saved)
    status.value = { kind: 'success', text: 'Store details saved.' }
  } catch (err) {
    status.value = { kind: 'danger', text: err.message }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="store-settings scroll">
    <form class="container-fluid px-0" novalidate @submit.prevent="save">
      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <section class="card h-100">
            <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
              <h2 class="h6 fw-bold mb-0">Details</h2>
              <label class="form-check form-switch mb-0 small fw-bold text-nowrap" title="This switch saves straight away">
                <input class="form-check-input" type="checkbox" role="switch" :checked="store.is_open" :disabled="busy[store.id]" @change="orders.setStoreOpen(store.id, $event.target.checked)">
                <span class="form-check-label">{{ store.is_open ? 'Taking orders' : 'Paused' }}</span>
              </label>
            </div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-12">
                  <label for="store-name" class="form-label fw-semibold">Store name</label>
                  <input id="store-name" v-model="draft.name" type="text" class="form-control" :class="{ 'is-invalid': invalid('name') }" maxlength="80" required>
                  <div class="invalid-feedback">{{ errors.name }}</div>
                </div>
                <div class="col-12">
                  <label for="store-desc" class="form-label fw-semibold">Description</label>
                  <textarea id="store-desc" v-model="draft.description" class="form-control" :class="{ 'is-invalid': invalid('description') }" rows="4" maxlength="500"></textarea>
                  <div class="invalid-feedback">{{ errors.description }}</div>
                  <div class="form-text text-end">{{ draft.description.length }}/500</div>
                </div>
                <div class="col-12">
                  <label for="store-img" class="form-label fw-semibold">Image URL</label>
                  <input id="store-img" v-model="draft.image_url" type="url" class="form-control" :class="{ 'is-invalid': invalid('image_url') }" placeholder="https://…">
                  <div class="invalid-feedback">{{ errors.image_url }}</div>
                </div>
                <div class="col-12">
                  <img v-if="previewUrl" :src="previewUrl" alt="Store image preview" class="preview img-fluid rounded-3 border w-100">
                  <div v-else class="preview rounded-3 border bg-body-tertiary d-flex align-items-center justify-content-center text-body-secondary"><i class="bi bi-image fs-2" aria-hidden="true"></i></div>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div class="col-12 col-lg-6">
          <section class="card h-100">
            <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
              <h2 class="h6 fw-bold mb-0">Opening hours</h2>
              <button type="button" class="btn btn-sm btn-outline-secondary" @click="copyMonday">Copy Monday to all</button>
            </div>
            <ul class="list-group list-group-flush">
              <li v-for="[d, label] in DAYS" :key="d" class="list-group-item">
                <div class="row g-2 align-items-center">
                  <div class="col-4">
                    <label class="form-check form-switch mb-0 fw-semibold">
                      <input v-model="draft.hours[d].open" class="form-check-input" type="checkbox" role="switch">
                      <span class="form-check-label">{{ label }}</span>
                    </label>
                  </div>
                  <div class="col-8">
                    <div v-if="draft.hours[d].open" class="input-group input-group-sm">
                      <input v-model="draft.hours[d].from" type="time" class="form-control" :class="{ 'is-invalid': invalid(d) }" :aria-label="label + ' opens'">
                      <span class="input-group-text">to</span>
                      <input v-model="draft.hours[d].to" type="time" class="form-control" :class="{ 'is-invalid': invalid(d) }" :aria-label="label + ' closes'">
                    </div>
                    <span v-else class="text-body-secondary small">Closed</span>
                  </div>
                  <div v-if="invalid(d)" class="col-12 text-danger small">{{ errors[d] }}</div>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>
      <div class="save-bar sticky-bottom d-flex align-items-center gap-3 flex-wrap py-3">
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</button>
        <button type="button" class="btn btn-outline-secondary" :disabled="saving" @click="reset(store)">Discard</button>
        <div v-if="status.text" class="alert py-2 px-3 mb-0" :class="'alert-' + status.kind" role="status">{{ status.text }}</div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.store-settings {
  flex: 1;
  min-height: 0;
  padding: 14px 18px 0;
}
.card {
  border-radius: 14px;
  overflow: hidden;
}
.preview {
  height: 180px;
  object-fit: cover;
}
.save-bar {
  background: var(--canvas);
}
</style>
