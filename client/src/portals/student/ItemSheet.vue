<script setup>
// Customise a dish: option groups with their rules, quantity, and add to cart
import { computed } from 'vue'
import { S, Q, A } from '@/stores/compat.js'
import * as E from '@/utils/engine.js'

const u = computed(() => S.ui.student)
const money = E.money
const item = computed(() => Q.item(u.value.itemId))
const groups = computed(() => Q.groups(item.value.id))
const options = computed(() => Q.options(item.value.id))
const sel = computed(() => u.value.draft.selected)
const v = computed(() => E.validate(groups.value, options.value, sel.value))
const unit = computed(() => E.unitPrice(item.value, options.value, sel.value))
const opts = (g) => options.value.filter((o) => o.group_id === g.id)
const isOn = (o) => sel.value.includes(o.id)
const blocked = (g, o) => !o.available || (g.type === 'multi' && !isOn(o) && v.value.byGroup[g.id].full)
</script>

<template>
  <div class="sheet item-sheet" role="dialog" :aria-label="item.name">
    <div class="grab"></div>
    <div class="sheet-head">
      <div><h3>{{ item.name }}</h3><p>{{ item.description }} <b>From {{ money(item.price) }}</b></p></div>
      <button class="icon-btn" aria-label="Close" @click="A.closeSheet()"><Icon name="close" :size="18" /></button>
    </div>
    <div class="sheet-body scroll">
      <section v-for="g in groups" :key="g.id" class="opt-group">
        <header>
          <strong>{{ g.name }}</strong>
          <span class="rule" :class="v.byGroup[g.id].ok ? 'ok' : (v.byGroup[g.id].count ? 'warn' : '')">
            <template v-if="v.byGroup[g.id].ok"><Icon name="check" :size="12" :stroke="3" />{{ g.type === 'multi' ? v.byGroup[g.id].count + ' picked' : (v.byGroup[g.id].count ? 'Chosen' : E.ruleLabel(g)) }}</template>
            <template v-else-if="v.byGroup[g.id].count">{{ v.byGroup[g.id].count }} of {{ v.byGroup[g.id].min }} minimum</template>
            <template v-else>{{ E.ruleLabel(g) }}</template>
          </span>
        </header>
        <div :class="g.type === 'multi' && opts(g).length > 5 ? 'opt-grid' : 'opt-list'">
          <button v-for="o in opts(g)" :key="o.id" class="opt" :class="{ on: isOn(o), blocked: blocked(g, o), radio: g.type === 'single' }" :disabled="blocked(g, o)" :aria-pressed="isOn(o)" @click="A.toggleOption(o.id)">
            <i class="opt-mark"><Icon v-if="isOn(o)" name="check" :size="11" :stroke="3.2" /></i>
            <span class="opt-name">{{ o.name }}<template v-if="!o.available"> (sold out)</template></span>
            <span v-if="Number(o.price_delta)" class="opt-price">+{{ money(o.price_delta) }}</span>
          </button>
        </div>
      </section>
    </div>
    <footer class="sheet-foot">
      <div class="qty">
        <button class="icon-btn" aria-label="One fewer" @click="A.setDraftQty(u.draft.qty - 1)"><Icon name="minus" :size="16" /></button>
        <b>{{ u.draft.qty }}</b>
        <button class="icon-btn" aria-label="One more" @click="A.setDraftQty(u.draft.qty + 1)"><Icon name="plus" :size="16" /></button>
      </div>
      <button class="btn btn-primary btn-lg add-btn" :disabled="!v.ok" @click="A.addToCart()">
        <template v-if="v.ok">Add to cart · {{ money(unit * u.draft.qty) }}</template>
        <template v-else>{{ v.hint }}</template>
      </button>
    </footer>
  </div>
</template>
