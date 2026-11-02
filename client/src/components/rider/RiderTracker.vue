<script setup>
// "Where is my rider": a live 2D map of the courier bringing the food over, how far away
// they are and when they should arrive. Shown on the tracking page while a peer delivery
// is in progress (accepted or picked up).
//
// Position: the courier's phone GPS when it is sharing (composables/useRiderLocation.js),
// otherwise an estimate along the walking route (utils/riderPosition.js). The chip in the
// corner says which. The map (riderMap.js, Leaflet) loads only when this shows.
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import * as E from '@/utils/engine.js'
import { LANDMARKS, shortName } from '@/utils/landmarks.js'
import { getRoute, ensureRoute } from '@/utils/routing.js'
import { riderEstimate, pathLength } from '@/utils/riderPosition.js'
import { useRiderLocation } from '@/composables/useRiderLocation.js'
import { useCatalogStore } from '@/stores/catalog.js'

const props = defineProps({
  delivery: { type: Object, required: true }, // { id, status, courier_name, picked_up_at }
  from: { type: Object, required: true }, // the store's venue { lat, lng, name }
  to: { type: Object, required: true }, // the drop-off point { lat, lng, name }
  now: { type: Number, required: true },
  fetchLocation: { type: Function, default: undefined }, // swap the API call (demo, tests)
})

const catalog = useCatalogStore()
const first = (name) => (name || 'Courier').split(' ')[0]
const active = computed(() => ['accepted', 'picked_up'].includes(props.delivery.status))
const carrying = computed(() => props.delivery.status === 'picked_up')
const { fix } = useRiderLocation(() => props.delivery.id, active, { fetchLocation: props.fetchLocation })

const route = computed(() => getRoute(props.from, props.to))
const est = computed(() => riderEstimate({
  coords: route.value.coords, status: props.delivery.status,
  pickedUpAt: props.delivery.picked_up_at, now: props.now, fix: fix.value,
}))
const arriveAt = computed(() => (est.value.secondsLeft == null ? null : props.now + est.value.secondsLeft * 1000))

// Numbers glide instead of jumping
const shown = reactive({ metres: est.value.metresLeft || 0 })
watch(() => est.value.metresLeft, (m) => { if (m != null) gsap.to(shown, { metres: m, duration: 1.2, ease: 'power2.out', overwrite: true }) })

const root = ref(null), box = ref(null), bar = ref(null)
const failed = ref(false)

// Every SMU building once: the map's landmarks plus the database's venues, minus any venue
// within 50 m of one already listed (the same building under another name)
function campusBuildings() {
  const list = []
  for (const b of [...LANDMARKS, ...catalog.db.venues.map((v) => ({ ...v, short: shortName(v.name) }))]) {
    if (!list.some((x) => pathLength([[x.lat, x.lng], [b.lat, b.lng]]) < 50)) list.push(b)
  }
  return list
}
// The other stores, pinned at their venue (the pickup store has its own beam)
function campusStores() {
  return catalog.db.stores
    .filter((s) => s.name !== props.from.name)
    .map((s) => ({ ...catalog.venue(s.venue_id), name: s.name }))
    .filter((s) => Number.isFinite(s.lat))
}
let scene = null, observer = null, ctx = null, gone = false

watch(() => est.value.progress, (p) => { if (bar.value) gsap.to(bar.value, { scaleX: p, duration: 1.2, ease: 'power2.out' }) })
// rebuild the route only when the points change (the real route arrives after an estimate)
watch(() => route.value.coords.flat().join(','), () => scene && scene.setRoute(route.value.coords))
watch(() => [est.value.lat, est.value.lng, est.value.progress], () => scene && scene.setRider(est.value))

onMounted(async () => {
  ensureRoute(props.from, props.to)
  const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ctx = gsap.context(() => {
    gsap.set(bar.value, { scaleX: est.value.progress })
    if (!reducedMotion) gsap.from('.hud > *', { y: 18, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 0.35 })
  }, root.value)

  try {
    const { createRiderMap } = await import('./riderMap.js')
    if (gone) return
    scene = createRiderMap(box.value, {
      from: props.from, to: props.to, coords: route.value.coords, reducedMotion,
      riderName: first(props.delivery.courier_name), buildings: campusBuildings(), stores: campusStores(),
    })
  } catch (e) {
    console.warn('[rider] map unavailable, showing the plain card:', e.message)
    failed.value = true
    return
  }
  scene.setRider(est.value)
  observer = new ResizeObserver(() => scene.resize())
  observer.observe(box.value)
})

onBeforeUnmount(() => {
  gone = true
  if (observer) observer.disconnect()
  if (scene) scene.dispose()
  if (ctx) ctx.revert()
  gsap.killTweensOf(shown)
})
</script>

<template>
  <section ref="root" class="rider" :class="{ flat: failed }" aria-label="Where is your rider">
    <div v-show="!failed" ref="box" class="stage" aria-hidden="true"></div>

    <div class="hud hud-top d-flex align-items-start justify-content-between gap-2">
      <div>
        <small class="eyebrow">Where is my rider</small>
        <strong class="leg">{{ carrying ? 'On the way to you' : 'Heading to the store' }}</strong>
      </div>
      <span class="chip d-inline-flex align-items-center gap-2" :class="est.source"
        :title="est.source === 'gps' ? 'From the courier\'s phone' : 'The courier\'s phone is not sharing GPS, so this is worked out from walking time'">
        <i></i>{{ est.source === 'gps' ? 'Live GPS' : 'Estimated' }}<template v-if="est.accuracy"> &plusmn;{{ est.accuracy }} m</template>
      </span>
    </div>

    <div class="hud hud-card">
      <div class="d-flex align-items-center gap-3">
        <Avatar :name="delivery.courier_name" :size="42" tone="brand" />
        <div class="flex-grow-1 overflow-hidden">
          <template v-if="carrying">
            <div class="big"><span>{{ Math.round(shown.metres) }}</span><small> m away</small></div>
            <p class="sub m-0">{{ first(delivery.courier_name) }} is walking to {{ to.name }}<template v-if="arriveAt">, arrives about <b>{{ E.clock(arriveAt) }}</b></template></p>
          </template>
          <template v-else>
            <div class="big big-sm">Collecting your food</div>
            <p class="sub m-0">{{ first(delivery.courier_name) }} is picking it up from {{ from.name }}</p>
          </template>
        </div>
      </div>
      <div class="track mt-3" aria-hidden="true"><i ref="bar"></i></div>
      <div class="ends d-flex justify-content-between mt-1"><span>{{ from.name }}</span><span>{{ to.name }}</span></div>
      <p v-if="failed" class="no3d m-0 mt-2">The map isn't available right now.</p>
    </div>
  </section>
</template>

<style scoped>
.rider {
  --night: #0a0f24;
  --glow: #ff6a3d;
  --sky: #8ea2ff;
  position: relative;
  height: clamp(340px, 58vh, 540px);
  border-radius: 22px;
  overflow: hidden;
  isolation: isolate;
  color: #fff;
  background:
    radial-gradient(120% 80% at 70% 0%, rgba(111, 140, 255, 0.28), transparent 60%),
    radial-gradient(90% 70% at 10% 100%, rgba(255, 106, 61, 0.22), transparent 60%),
    var(--night);
  box-shadow: 0 24px 60px -24px rgba(10, 15, 36, 0.65), inset 0 0 0 1px rgba(142, 162, 255, 0.18);
}

.rider.flat {
  height: 240px;
}

.stage {
  position: absolute;
  inset: 0;
  background: #f2efe9; /* OpenStreetMap's land colour, shown while tiles load */
  font: inherit;
}

/* Same normal OpenStreetMap look as the campus map on the Explore page
   (the old dark "night" filter on the tiles is gone). */

/* every map label hangs centred above its point */
.stage :deep(.rmk > span) {
  position: absolute;
  transform: translate(-50%, calc(-100% - 10px));
}

.stage :deep(.tag) {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
  pointer-events: none;
  background: rgba(10, 15, 36, 0.72);
  backdrop-filter: blur(6px);
  border: 1px solid currentColor;
}

.stage :deep(.t-store) { color: #ffb59c; }

.stage :deep(.place) {
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 0 2px #fff, 0 0 6px #fff;
}

.stage :deep(.rmk > .place-building) { transform: translate(-50%, -50%); }

.stage :deep(.place-building) {
  color: #3b4466;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 9px;
}

.stage :deep(.place-store) {
  color: #8a4b00;
  white-space: pre;
  line-height: 1.35;
  text-align: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 179, 71, 0.9);
}
.stage :deep(.t-drop) { color: #8ff5c9; }
.stage :deep(.t-rider) { color: #fff; border-color: var(--glow); background: rgba(255, 106, 61, 0.35); }

/* the courier: a glowing dot with a radar ring, name above */
.stage :deep(.courier i) {
  position: absolute;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #ffd2c0;
  border: 3px solid var(--glow);
  box-shadow: 0 0 18px 4px rgba(255, 106, 61, 0.7);
}

.stage :deep(.courier.live i) { animation: radar 1.8s infinite; }

.stage :deep(.courier .tag) {
  position: absolute;
  transform: translate(-50%, calc(-100% - 14px));
}

@keyframes radar {
  0% { box-shadow: 0 0 18px 4px rgba(255, 106, 61, 0.7), 0 0 0 0 rgba(255, 106, 61, 0.6); }
  100% { box-shadow: 0 0 18px 4px rgba(255, 106, 61, 0.7), 0 0 0 28px rgba(255, 106, 61, 0); }
}

.hud {
  position: absolute;
  left: 12px;
  right: 12px;
  z-index: 1000; /* above Leaflet's panes and controls */
}

.hud-top {
  top: 12px;
  pointer-events: none;
}

.hud-top > div {
  padding: 8px 12px;
  border-radius: 14px;
  background: linear-gradient(160deg, rgba(30, 42, 90, 0.78), rgba(10, 15, 36, 0.82));
  backdrop-filter: blur(10px);
}

.eyebrow {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 10.5px;
  font-weight: 800;
  color: var(--sky);
}

.leg {
  font-family: var(--font-display);
  font-size: 20px;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 18px rgba(10, 15, 36, 0.9);
}

.chip {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 10px;
  border-radius: 999px;
  backdrop-filter: blur(8px);
  white-space: nowrap;
}

.chip i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: beat 1.6s infinite;
}

.chip.gps { color: #7dffc6; background: rgba(10, 15, 36, 0.8); border: 1px solid rgba(46, 229, 157, 0.6); }
.chip.estimate { color: #ffd48a; background: rgba(10, 15, 36, 0.8); border: 1px solid rgba(255, 190, 90, 0.6); }

@keyframes beat {
  0% { box-shadow: 0 0 0 0 currentColor; }
  70%, 100% { box-shadow: 0 0 0 7px transparent; }
}

.hud-card {
  bottom: 12px;
  padding: 14px 16px 12px;
  border-radius: 18px;
  background: linear-gradient(160deg, rgba(30, 42, 90, 0.72), rgba(10, 15, 36, 0.78));
  backdrop-filter: blur(14px) saturate(1.4);
  border: 1px solid rgba(142, 162, 255, 0.22);
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.55);
}

.big {
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.big small {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0;
  color: rgba(255, 255, 255, 0.7);
}

.big-sm { font-size: 24px; }

.sub {
  margin-top: 4px !important;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.78);
}

.sub b { color: #fff; }

.track {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  transform-origin: left;
  background: linear-gradient(90deg, #ff9a6b, var(--glow));
  box-shadow: 0 0 14px var(--glow);
}

.ends {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.55);
}

.no3d {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.55);
}

@media (prefers-reduced-motion: reduce) {
  .chip i { animation: none; }
}
</style>
