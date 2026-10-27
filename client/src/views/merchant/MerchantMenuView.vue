<script setup>
import { computed, inject, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useMerchantStore } from '@/stores/merchant.js'
import MenuItemAdminCard from '@/portals/merchant/MenuItemAdminCard.vue'

const URL_RE = /^https?:\/\/\S+$/

const ui = useUiStore()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const merchant = useMerchantStore()
const { busy } = storeToRefs(ui)
const store = inject('merchantStore')
const menu = computed(() => catalog.menuOf(store.value.id)
  .slice()
  .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name)))
const categories = computed(() => [...new Set(catalog.menuOf(store.value.id).map((m) => m.category).filter(Boolean))].sort())

const editing = ref(null)
const draft = reactive({})
const tried = ref(false)
const saving = ref(false)
const formError = ref('')
const removing = ref(null)

function openForm(item = null) {
  editing.value = item ? item.id : 'new'
  Object.assign(draft, {
    name: item ? item.name : '',
    category: item ? item.category || '' : categories.value[0] || '',
    price: item ? item.price : '',
    description: item ? item.description || '' : '',
    image_url: item ? item.image_url || '' : '',
    cook_min: item ? Math.round((item.cook_time_sec / 60) * 10) / 10 : 5,
    max_at_once: item ? item.max_at_once : 1,
    available: item ? item.available : true,
  })
  tried.value = false
  formError.value = ''
}
const closeForm = () => { editing.value = null }

const errors = computed(() => {
  const e = {}
  if (!String(draft.name || '').trim()) e.name = 'Name is required.'
  if (!String(draft.category || '').trim()) e.category = 'Category is required.'
  const price = Number(draft.price)
  if (draft.price === '' || !Number.isFinite(price) || price < 0 || price > 1000) e.price = 'Enter a price from $0 to $1000.'
  if (String(draft.description || '').length > 300) e.description = 'Keep it to 300 characters or fewer.'
  if (draft.image_url && !URL_RE.test(String(draft.image_url).trim())) e.image_url = 'Use a full link starting with http:// or https://.'
  const cook = Number(draft.cook_min)
  if (!Number.isFinite(cook) || cook <= 0 || cook > 120) e.cook_min = 'Cook time must be more than 0 and at most 120 minutes.'
  if (!Number.isInteger(Number(draft.max_at_once)) || Number(draft.max_at_once) < 1 || Number(draft.max_at_once) > 100) e.max_at_once = 'Batch size must be a whole number from 1 to 100.'
  return e
})
const invalid = (k) => tried.value && errors.value[k]

async function save() {
  tried.value = true
  formError.value = ''
  if (Object.keys(errors.value).length) return
  const fields = {
    name: draft.name.trim(),
    category: draft.category.trim(),
    price: Number(draft.price),
    description: draft.description.trim(),
    image_url: draft.image_url.trim(),
    cook_time_sec: Math.max(1, Math.round(Number(draft.cook_min) * 60)),
    max_at_once: Number(draft.max_at_once),
    available: draft.available,
  }
  saving.value = true
  try {
    const isNew = editing.value === 'new'
    if (isNew) await merchant.addMenuItem(store.value.id, fields)
    else await merchant.saveMenuItem(editing.value, fields)
    ui.notify(isNew ? 'Item added' : 'Item saved', fields.name, 'ok')
    closeForm()
  } catch (err) {
    formError.value = err.message
  } finally {
    saving.value = false
  }
}

async function remove(item) {
  removing.value = item.id
  try {
    await merchant.removeMenuItem(item.id)
    ui.notify('Item removed', item.name, 'ok')
  } catch (err) {
    ui.notify("That didn't work", err.message, 'warn')
  } finally {
    removing.value = null
  }
}
</script>

<template>
  <div class="m-menu scroll">
    <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
      <p class="m-hint mb-0">Switching an item off hides it from students straight away. Cook time and batch size feed the wait-time estimate.</p>
      <button type="button" class="btn btn-primary btn-sm text-nowrap" @click="openForm()"><i class="bi bi-plus-lg" aria-hidden="true"></i> Add item</button>
    </div>
    <p v-if="!menu.length" class="col-empty">No items yet. Add your first dish.</p>
    <div class="row g-3">
      <div v-for="it in menu" :key="it.id" class="col-12 col-md-6 col-lg-4">
        <MenuItemAdminCard
          :item="it"
          :busy="!!busy[it.id]"
          :removing="removing === it.id"
          @toggle-available="orders.setItemAvailable(it.id, $event)"
          @edit="openForm"
          @remove="remove"
        />
      </div>
    </div>

    <template v-if="editing">
      <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="item-form-title" @keydown.esc="closeForm">
        <div class="modal-dialog modal-dialog-scrollable modal-lg modal-dialog-centered">
          <form class="modal-content" novalidate @submit.prevent="save">
            <div class="modal-header">
              <h5 id="item-form-title" class="modal-title">{{ editing === 'new' ? 'Add item' : 'Edit item' }}</h5>
              <button type="button" class="btn-close" aria-label="Close" @click="closeForm"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-12 col-md-7">
                  <label for="item-name" class="form-label">Name</label>
                  <input id="item-name" v-model="draft.name" type="text" class="form-control" :class="{ 'is-invalid': invalid('name') }" maxlength="80" required>
                  <div class="invalid-feedback">{{ errors.name }}</div>
                </div>
                <div class="col-12 col-md-5">
                  <label for="item-cat" class="form-label">Category</label>
                  <input id="item-cat" v-model="draft.category" type="text" class="form-control" :class="{ 'is-invalid': invalid('category') }" list="item-cats" maxlength="40" required>
                  <datalist id="item-cats"><option v-for="c in categories" :key="c" :value="c" /></datalist>
                  <div class="invalid-feedback">{{ errors.category }}</div>
                </div>
                <div class="col-12">
                  <label for="item-desc" class="form-label">Description</label>
                  <textarea id="item-desc" v-model="draft.description" class="form-control" :class="{ 'is-invalid': invalid('description') }" rows="2" maxlength="300"></textarea>
                  <div class="invalid-feedback">{{ errors.description }}</div>
                </div>
                <div class="col-12">
                  <label for="item-img" class="form-label">Image URL</label>
                  <input id="item-img" v-model="draft.image_url" type="url" class="form-control" :class="{ 'is-invalid': invalid('image_url') }" placeholder="https://…">
                  <div class="invalid-feedback">{{ errors.image_url }}</div>
                </div>
                <div class="col-12 col-md-4">
                  <label for="item-price" class="form-label">Price ($)</label>
                  <input id="item-price" v-model="draft.price" type="number" min="0" max="1000" step="0.1" class="form-control" :class="{ 'is-invalid': invalid('price') }" required>
                  <div class="invalid-feedback">{{ errors.price }}</div>
                </div>
                <div class="col-6 col-md-4">
                  <label for="item-cook" class="form-label">Cook time (min)</label>
                  <input id="item-cook" v-model="draft.cook_min" type="number" min="0.5" max="120" step="0.5" class="form-control" :class="{ 'is-invalid': invalid('cook_min') }" required>
                  <div class="invalid-feedback">{{ errors.cook_min }}</div>
                </div>
                <div class="col-6 col-md-4">
                  <label for="item-batch" class="form-label">Batch size</label>
                  <input id="item-batch" v-model="draft.max_at_once" type="number" min="1" max="100" step="1" class="form-control" :class="{ 'is-invalid': invalid('max_at_once') }" aria-describedby="item-batch-hint" required>
                  <div id="item-batch-hint" class="form-text">How many portions you can make together in one go.</div>
                  <div class="invalid-feedback">{{ errors.max_at_once }}</div>
                </div>
                <div class="col-12">
                  <label class="form-check form-switch mb-0 fw-bold">
                    <input v-model="draft.available" class="form-check-input" type="checkbox" role="switch">
                    <span class="form-check-label">{{ draft.available ? 'Available' : 'Sold out' }}</span>
                  </label>
                </div>
              </div>
              <div v-if="formError" class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ formError }}</div>
              <div v-else-if="tried && Object.keys(errors).length" class="alert alert-danger py-2 mt-3 mb-0" role="alert">Please fix the highlighted fields.</div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" :disabled="saving" @click="closeForm">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : editing === 'new' ? 'Add item' : 'Save changes' }}</button>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    </template>
  </div>
</template>

<style scoped>
.m-menu {
  flex: 1;
  padding: 14px 18px;
}
.m-hint {
  color: var(--muted);
}
@media (max-width: 720px) {
  .m-menu {
    padding-left: 12px;
    padding-right: 12px;
  }
}
</style>
