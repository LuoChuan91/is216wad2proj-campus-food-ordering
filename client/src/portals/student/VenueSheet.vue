<script setup>
// The stores in one venue, opened from the map or the "Near you" list.
// Draggable like the "Near you" sheet in ExploreView: drag the handle
// between three heights (header only, peek, full).
import { computed, ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useCatalogStore } from '@/stores/catalog.js'
import StoreCard from '@/components/StoreCard.vue'

const ui = useUiStore()
const catalog = useCatalogStore()
const { ui: uiState } = storeToRefs(ui)

const u = computed(() => uiState.value.student)
const venue = computed(() => catalog.venue(u.value.venueId))
const walk = computed(() => ui.walk(venue.value))
const stores = computed(() => catalog.storesAt(venue.value.id).map((s) => ({ s, open: ui.open(s), available: catalog.storeAvailable(s) })))

/* ---------- Draggable sheet ---------- */
const sheetEl = ref(null)
const grabEl = ref(null)
const headEl = ref(null)
const listEl = ref(null)
const areaH = ref(window.innerHeight) // height of the map area the sheet sits in
const chromeH = ref(80)               // handle + header
const contentH = ref(0)               // handle + header + whole list

// Full height fits the content, but never more than 72% of the map area
const fullH = computed(() => Math.min(Math.round(areaH.value * 0.72), Math.max(contentH.value, chromeH.value)))
const peekH = computed(() => Math.min(fullH.value, 420)) // the old fixed height
const snaps = computed(() => [chromeH.value, peekH.value, fullH.value]) // header only, peek, full
const snapIndex = ref(1) // open at peek

function measure() {
  const el = sheetEl.value
  if (!el) return
  areaH.value = el.parentElement ? el.parentElement.clientHeight : window.innerHeight
  chromeH.value = (grabEl.value?.offsetHeight || 22) + (headEl.value?.offsetHeight || 60)
  contentH.value = chromeH.value + (listEl.value?.scrollHeight || 0)
}

const drag = reactive({ active: false, startY: 0, startOff: 0, off: 0 })
const offsetOf = (h) => fullH.value - h
const sheetOffset = computed(() => (drag.active ? drag.off : offsetOf(snaps.value[snapIndex.value])))

// Height stays fixed; only transform moves (smooth on the GPU)
const sheetStyle = computed(() => ({
  height: fullH.value + 'px',
  maxHeight: 'none', // overrides the 420px cap from .vsheet in main.css
  transform: `translateY(${sheetOffset.value}px)`,
  transition: drag.active ? 'none' : 'transform .34s cubic-bezier(.22,.8,.24,1)',
}))
// The list gets exactly the space that is on screen, so it scrolls at every height
const listStyle = computed(() => ({ maxHeight: Math.max(0, fullH.value - sheetOffset.value - chromeH.value) + 'px' }))

function onGrabDown(e) {
  drag.active = true
  drag.startY = e.clientY
  drag.startOff = sheetOffset.value
  drag.off = drag.startOff
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onGrabMove(e) {
  if (!drag.active) return
  const maxOff = offsetOf(snaps.value[0]) // can't drag below "header only"
  drag.off = Math.min(maxOff, Math.max(0, drag.startOff + (e.clientY - drag.startY)))
}
function onGrabUp() {
  if (!drag.active) return
  drag.active = false
  let best = 0
  snaps.value.forEach((h, i) => {
    if (Math.abs(offsetOf(h) - drag.off) < Math.abs(offsetOf(snaps.value[best]) - drag.off)) best = i
  })
  snapIndex.value = best
}

// A pointer that moved was a drag, not a tap: don't let it open a store
const press = reactive({ x: 0, y: 0, moved: false })
function onSheetDown(e) { press.x = e.clientX; press.y = e.clientY; press.moved = false }
function onSheetMove(e) { if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true }
function onSheetClickCapture(e) {
  if (press.moved) { e.stopPropagation(); e.preventDefault(); press.moved = false }
}

onMounted(() => {
  nextTick(measure)
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
watch(() => stores.value.length, () => nextTick(measure))
</script>

<template>
  <div class="vsheet col-md-8 col-lg-6 mx-auto" ref="sheetEl" :style="sheetStyle"
    @pointerdown="onSheetDown" @pointermove="onSheetMove" @click.capture="onSheetClickCapture">
    <div class="vs-grab" ref="grabEl" @pointerdown="onGrabDown" @pointermove="onGrabMove" @pointerup="onGrabUp" @pointercancel="onGrabUp">
      <span class="grab"></span>
    </div>
    <div class="vsheet-head d-flex justify-content-between align-items-start gap-2" ref="headEl">
      <div>
        <h3>{{ venue.name }}</h3>
        <p class="d-flex align-items-center flex-wrap gap-1">
          <Icon name="walk" :size="14" />{{ walk.minutes }} min walk · {{ walk.meters }} m <span class="src">{{
            walk.source === 'osrm' ? 'OSRM walking route' : 'distance estimate' }}</span>
        </p>
      </div>
      <button class="icon-btn" aria-label="Close" @click="ui.closeSheet()">
        <Icon name="close" :size="18" />
      </button>
    </div>
    <div class="vsheet-list vs-list d-grid gap-2" ref="listEl" :style="listStyle">
      <p v-if="!stores.length" class="empty-note">No stores here yet.</p>
      <StoreCard v-for="x in stores" :key="x.s.id" :store="x.s" :open="x.open.open" :available="x.available">
        <small class="text-body-secondary">{{ x.s.cuisine }} · {{ x.s.unit_no }}</small>
      </StoreCard>
    </div>
  </div>
</template>

<style scoped>
.vsheet {
  will-change: transform;
  backface-visibility: hidden;
}
/* Drag handle: only this small area starts a drag */
.vs-grab {
  flex: none;
  display: flex;
  justify-content: center;
  width: fit-content;
  margin: 0 auto;
  padding: 9px 24px 5px;
  touch-action: none; /* stops the phone scrolling the page while you drag */
  cursor: grab;
  user-select: none;
}
.vs-grab:active {
  cursor: grabbing;
}
.vs-grab .grab {
  margin: 0;
}
/* Only the list scrolls */
.vs-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
}
</style>
