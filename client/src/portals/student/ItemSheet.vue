<script setup>
// Customise a dish: option groups with their rules, quantity, and add to cart
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import StatusTag from '@/components/StatusTag.vue'
import { useCatalogStore } from '@/stores/catalog.js'
import * as E from '@/utils/engine.js'

const ui = useUiStore()
const catalog = useCatalogStore()
const { ui: uiState } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const money = E.money
const item = computed(() => catalog.item(u.value.itemId))
const groups = computed(() => catalog.groups(item.value.id))
const options = computed(() => catalog.options(item.value.id))
const sel = computed(() => u.value.draft.selected)
const v = computed(() => E.validate(groups.value, options.value, sel.value))
const unit = computed(() => E.unitPrice(item.value, options.value, sel.value))
const opts = (g) => options.value.filter((o) => o.group_id === g.id)
const isOn = (o) => sel.value.includes(o.id)
const blocked = (g, o) => !o.available || (g.type === 'multi' && !isOn(o) && v.value.byGroup[g.id].full)
</script>

<template>
  <div class="sheet item-sheet col-md-8 col-lg-6 mx-auto" role="dialog" :aria-label="item.name">
    <div class="grab"></div>
    <div class="sheet-head d-flex justify-content-between align-items-start gap-2">
      <div><h3>{{ item.name }}</h3><p>{{ item.description }} <b>From {{ money(item.price) }}</b></p></div>
      <button class="icon-btn" aria-label="Close" @click="ui.closeSheet()"><Icon name="close" :size="18" /></button>
    </div>
    <div class="sheet-body scroll">
      <section v-for="g in groups" :key="g.id" class="opt-group">
        <header class="d-flex justify-content-between align-items-center mb-2">
          <strong>{{ g.name }}</strong>
          <StatusTag :tone="v.byGroup[g.id].ok ? 'ok' : (v.byGroup[g.id].count ? 'warn' : '')">
            <template v-if="v.byGroup[g.id].ok"><Icon name="check" :size="12" :stroke="3" />{{ g.type === 'multi' ? v.byGroup[g.id].count + ' picked' : (v.byGroup[g.id].count ? 'Chosen' : E.ruleLabel(g)) }}</template>
            <template v-else-if="v.byGroup[g.id].count">{{ v.byGroup[g.id].count }} of {{ v.byGroup[g.id].min }} minimum</template>
            <template v-else>{{ E.ruleLabel(g) }}</template>
          </StatusTag>
        </header>
        <div :class="g.type === 'multi' && opts(g).length > 5 ? 'opt-grid' : 'opt-list'">
          <button v-for="o in opts(g)" :key="o.id" class="opt d-flex align-items-center gap-2 text-start" :class="{ on: isOn(o), blocked: blocked(g, o), radio: g.type === 'single' }" :disabled="blocked(g, o)" :aria-pressed="isOn(o)" @click="ui.toggleOption(o.id)">
            <i class="opt-mark d-flex align-items-center justify-content-center flex-shrink-0"><Icon v-if="isOn(o)" name="check" :size="11" :stroke="3.2" /></i>
            <span class="opt-name flex-grow-1 overflow-hidden">{{ o.name }}<template v-if="!o.available"> (sold out)</template></span>
            <span v-if="Number(o.price_delta)" class="opt-price">+{{ money(o.price_delta) }}</span>
          </button>
        </div>
      </section>
    </div>
    <footer class="sheet-foot d-flex align-items-center gap-3">
      <div class="qty d-inline-flex align-items-center gap-2 flex-shrink-0">
        <button class="icon-btn" aria-label="One fewer" @click="ui.setDraftQty(u.draft.qty - 1)"><Icon name="minus" :size="16" /></button>
        <b>{{ u.draft.qty }}</b>
        <button class="icon-btn" aria-label="One more" @click="ui.setDraftQty(u.draft.qty + 1)"><Icon name="plus" :size="16" /></button>
      </div>
      <button class="btn btn-primary btn-lg flex-grow-1" :disabled="!v.ok" @click="ui.addToCart()">
        <template v-if="v.ok">Add to cart · {{ money(unit * u.draft.qty) }}</template>
        <template v-else>{{ v.hint }}</template>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.opt-group {
  margin-bottom: 14px;
}
.opt-group header strong {
  font-size: var(--fs-subheading);
}
.opt-list {
  display: grid;
  gap: 6px;
}
.opt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.opt {
  border: 1.5px solid var(--line);
  background: var(--paper);
  border-radius: 12px;
  padding: 8px 10px;
  font-size: var(--fs-desc);
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
  min-height: 40px;
}
.opt.on {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.opt.blocked {
  opacity: 0.4;
  cursor: not-allowed;
}
.opt-mark {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1.5px solid #c2c7d3;
  color: #fff;
}
.opt.radio .opt-mark {
  border-radius: 50%;
}
.opt.on .opt-mark {
  background: var(--brand);
  border-color: var(--brand);
}
.opt-name {
  line-height: 1.2;
}
.opt-price {
  color: var(--muted);
  font-size: var(--fs-caption);
  font-weight: 700;
  white-space: nowrap;
}
.opt.on .opt-price {
  color: var(--brand-600);
}
</style>
