// Pure, framework-free wait-time estimation.
//
// Given the order-items in the queue ahead of you and each menu item's cooking
// details (cook_time_sec, max_at_once = batch size), estimate how many seconds
// until the kitchen clears that queue.
//
// Per dish:
//   batches   = ceil(totalQty / max_at_once)   (how many back-to-back batches)
//   itemTime  = batches * cook_time_sec        (seconds to cook all of that dish)
//
// Each dish therefore expands into a list of BATCHES, every batch taking
// cook_time_sec seconds (a half-full final batch still occupies the station for a
// full cook_time_sec). Example: 3 batches of A (180s) + 4 batches of B (120s)
// expands to [180,180,180,120,120,120,120].
//
// How those times combine depends on the strategy, because a real kitchen is
// somewhere between "one serial line" and "many parallel stations":
//   - 'serial'     : sum(itemTime)                  one line, cook dishes one after another (upper bound)
//   - 'bottleneck' : max(itemTime)                  unlimited parallel stations, limited by the busiest dish
//   - 'factor'     : max(bottleneck, sum/stations)  rough division of total work across n stations
//   - 'scheduled'  : LPT list-scheduling of BATCHES across n stations -> makespan
//                    Sort batches longest-first, assign each to the station that
//                    is free earliest, and return when the last station finishes.
//                    This models a fixed number of stations more faithfully than
//                    'factor' (two long batches can't share one station).
//
// The strategy is pluggable so the formula can be swapped without touching the UI.

// serial/bottleneck/factor work on PER-DISH totals (itemTimes).
// scheduled works on the expanded PER-BATCH list (batchTimes).
const STRATEGIES = {
  serial: ({ itemTimes }) => itemTimes.reduce((sum, t) => sum + t, 0),
  bottleneck: ({ itemTimes }) => (itemTimes.length ? Math.max(...itemTimes) : 0),
  factor: ({ itemTimes }, { stations = 2 } = {}) => {
    if (!itemTimes.length) return 0;
    const n = Math.max(1, Math.floor(stations));
    const sum = itemTimes.reduce((s, t) => s + t, 0);
    const bottleneck = Math.max(...itemTimes);
    // Can never be faster than the single busiest dish, nor than sharing the
    // total work across n stations.
    return Math.max(bottleneck, Math.ceil(sum / n));
  },
  // LPT (longest-processing-time-first) list scheduling of individual batches.
  scheduled: ({ batchTimes }, { stations = 2 } = {}) => {
    if (!batchTimes.length) return 0;
    const n = Math.max(1, Math.floor(stations));
    // Longest batch first.
    const sorted = [...batchTimes].sort((a, b) => b - a);
    // Each station's running "free at" time; start all idle at 0.
    const stationEnds = new Array(n).fill(0);
    for (const t of sorted) {
      // Assign this batch to the station that becomes free earliest.
      let earliest = 0;
      for (let i = 1; i < n; i++) {
        if (stationEnds[i] < stationEnds[earliest]) earliest = i;
      }
      stationEnds[earliest] += t;
    }
    // The queue is cleared when the last (busiest) station finishes.
    return Math.max(...stationEnds);
  },
};

/**
 * Estimate the queue cooking time in whole seconds.
 *
 * @param {Array<{menu_item_id: string, qty: number}>} orderItems
 *        Flat list of order-items ahead in the queue. Items for the same dish
 *        are grouped and their quantities summed.
 * @param {Array<{id: string, cook_time_sec: number, max_at_once: number}>} cookingDetails
 *        Cooking details per menu item. Missing entries are treated as 0 cook
 *        time and reported in `missing`.
 * @param {{strategy?: 'serial'|'bottleneck'|'factor'|'scheduled', stations?: number}} [options]
 * @returns {{ seconds: number, perItem: Array<{menuItemId: string, qty: number, batches: number, seconds: number}>, missing: string[] }}
 */
export function estimateWaitTime(orderItems, cookingDetails, options = {}) {
  // Intrinsic library defaults (used only if a caller omits options). Real app
  // callers always pass resolved { strategy, stations } from waitSettings(),
  // whose fallback is config.wait — the single source of truth for the store
  // default. These intrinsic defaults are deliberately the safe upper bound.
  const { strategy = 'serial', stations = 2 } = options;
  const aggregate = STRATEGIES[strategy];
  if (!aggregate) {
    throw new Error(
      `Unknown wait-time strategy "${strategy}". Use one of: ${Object.keys(STRATEGIES).join(', ')}`
    );
  }

  const items = Array.isArray(orderItems) ? orderItems : [];
  const details = Array.isArray(cookingDetails) ? cookingDetails : [];

  // Index cooking details by menu item id for O(1) lookup.
  const detailById = new Map();
  for (const d of details) {
    if (d && d.id != null) detailById.set(d.id, d);
  }

  // Sum quantities per dish.
  const qtyByItem = new Map();
  for (const oi of items) {
    if (!oi || oi.menu_item_id == null) continue;
    const qty = Number(oi.qty) || 0;
    qtyByItem.set(oi.menu_item_id, (qtyByItem.get(oi.menu_item_id) || 0) + qty);
  }

  const perItem = [];
  const missing = [];
  const itemTimes = []; // one total per dish (serial/bottleneck/factor)
  const batchTimes = []; // one entry per batch (scheduled)

  for (const [menuItemId, totalQty] of qtyByItem) {
    if (totalQty <= 0) continue;
    const detail = detailById.get(menuItemId);
    if (!detail) missing.push(menuItemId);

    const cookTime = Math.max(0, Number(detail?.cook_time_sec) || 0);
    const batchSize = Math.max(1, Number(detail?.max_at_once) || 1);
    const batches = Math.ceil(totalQty / batchSize);
    const seconds = batches * cookTime;

    perItem.push({ menuItemId, qty: totalQty, batches, seconds });
    itemTimes.push(seconds);
    // Expand into individual batches; each batch costs a full cookTime.
    if(strategy=='scheduled') batchTimes.push(...Array(batches).fill(cookTime));
    
  }

  const seconds = Math.round(aggregate({ itemTimes, batchTimes }, { stations }));
  return { seconds, perItem, missing };
}

/**
 * Human-friendly label for a number of seconds, e.g. "~12 min", "~45 sec".
 * @param {number} seconds
 * @returns {string}
 */
export function formatWaitTime(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s === 0) return 'No wait';
  if (s < 60) return `~${s} sec`;
  const minutes = Math.round(s / 60);
  return `~${minutes} min`;
}

export const WAIT_TIME_STRATEGIES = Object.keys(STRATEGIES);

// ---------------------------------------------------------------------------
// Fresh-order probe (ported from the server's common/engine.js scheduleKitchen /
// estimateNew). Used by checkout: "when would THIS cart be ready, given the store
// queue ahead of it?" The server version returned absolute readyAt timestamps;
// here we return a relative wait in SECONDS plus the orders-ahead count, so the
// frontend stays the single wait-time machine (readyAt = now + seconds).
//
// Kitchen model (identical to the server):
//   - a store cooks `stations` batches at the same time;
//   - each order line becomes ceil(qty / max_at_once) batches of cook_time_sec;
//   - orders already 'preparing' keep the slot they started on;
//   - waiting ('placed') orders take the earliest free slot, FCFS.
//
// `orders`: [{ id, status:'placed'|'preparing', created_at, preparing_at, items:[{menu_item_id, qty}] }]
//           times in MILLISECONDS (matching the server shape).
// `menuById`: { [menuItemId]: { cook_time_sec, max_at_once } }

function scheduleKitchen(stations, orders, menuById, now) {
  const slotCount = Math.max(1, stations | 0);
  const slots = new Array(slotCount).fill(-Infinity);
  const earliest = () => slots.indexOf(Math.min(...slots));
  const batches = (o) =>
    (o.items || []).flatMap((it) => {
      const m = menuById[it.menu_item_id] || { cook_time_sec: 0, max_at_once: 1 };
      const n = Math.ceil(it.qty / Math.max(1, m.max_at_once));
      return Array.from({ length: n }, () => (Number(m.cook_time_sec) || 0) * 1000);
    });

  const preparing = orders
    .filter((o) => o.status === 'preparing')
    .sort((a, b) => a.preparing_at - b.preparing_at);
  const waiting = orders
    .filter((o) => o.status !== 'preparing')
    .sort((a, b) => a.created_at - b.created_at);
  const out = {};

  for (const o of preparing) {
    let ready = o.preparing_at;
    for (const ms of batches(o)) {
      const i = earliest();
      slots[i] = Math.max(slots[i], o.preparing_at) + ms;
      ready = Math.max(ready, slots[i]);
    }
    out[o.id] = { readyAt: Math.max(ready, now) };
  }

  for (let i = 0; i < slotCount; i++) slots[i] = Math.max(slots[i], now);

  for (const o of waiting) {
    let ready = now;
    for (const ms of batches(o)) {
      const i = earliest();
      slots[i] += ms;
      ready = Math.max(ready, slots[i]);
    }
    out[o.id] = { readyAt: ready };
  }

  return out;
}

/**
 * Estimate when a NOT-YET-PLACED cart would be ready, scheduled behind the
 * store's current queue. Returns a relative wait in whole seconds and how many
 * orders are ahead of it.
 *
 * Both DB-stored store settings are honoured:
 *   - `stations`  ← stores.workstations (how many batches cook in parallel)
 *   - `strategy`  ← stores.wait_strategy
 *       'scheduled' : batches run across `stations` parallel slots (default).
 *       'serial'    : one serial line — every batch runs one after another,
 *                     so the station count is forced to 1 (matching the
 *                     'serial' behaviour of estimateWaitTime).
 *
 * @param {Array<{id:string,status:string,created_at:number,preparing_at?:number,items:Array<{menu_item_id:string,qty:number}>}>} queueOrders
 *        the store's active orders (ms timestamps), as returned by the queue API.
 * @param {Array<{menu_item_id:string,qty:number}>} cartLines  the new cart's items.
 * @param {Array<{id:string,cook_time_sec:number,max_at_once:number}>} cookingDetails
 * @param {{ stations?: number, strategy?: 'serial'|'scheduled', now?: number }} [options]
 * @returns {{ seconds: number, ahead: number }}
 */
export function estimateNewOrderWait(queueOrders, cartLines, cookingDetails, options = {}) {
  // A serial kitchen is a single line: model it as one station so batches
  // queue sequentially. Any other strategy uses the store's workstation count.
  const workstations = Math.max(1, Math.floor(options.stations ?? 2));
  const stations = options.strategy === 'serial' ? 1 : workstations;
  const now = options.now ?? Date.now();

  const menuById = {};
  for (const d of Array.isArray(cookingDetails) ? cookingDetails : []) {
    if (d && d.id != null) menuById[d.id] = d;
  }

  const queue = (Array.isArray(queueOrders) ? queueOrders : []).map((o) => ({
    id: o.id,
    status: o.status === 'preparing' ? 'preparing' : 'placed',
    created_at: Number(o.created_at) || now,
    preparing_at: Number(o.preparing_at) || Number(o.created_at) || now,
    items: o.items || o.order_items || [],
  }));

  // The probe lands behind the current queue (created just after "now").
  const probe = { id: '__new', status: 'placed', created_at: now + 1, items: cartLines || [] };
  const schedule = scheduleKitchen(stations, queue.concat([probe]), menuById, now);
  const readyAt = schedule.__new ? schedule.__new.readyAt : now;

  return {
    seconds: Math.max(0, Math.round((readyAt - now) / 1000)),
    ahead: queue.length,
  };
}

export { scheduleKitchen };
