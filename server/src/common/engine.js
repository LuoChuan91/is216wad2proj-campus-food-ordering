// The wait-time engine from the prototype website, moved to the server unchanged.
// Pure functions: no database, no req/res, so they're easy to test.
//
// Kitchen model:
// - a store cooks `slots` batches at the same time;
// - each order line becomes ceil(qty / max_at_once) batches, each taking cook_time_sec;
// - orders already being prepared keep the slots they started on;
// - waiting orders take the earliest free slot, first come, first served.
//
// orders: [{ id, status: 'placed' | 'preparing', created_at, preparing_at, items: [{ menu_item_id, qty }] }]
//         (times in milliseconds)
// Returns { [orderId]: { readyAt, ahead, dishesAhead } }

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

function scheduleKitchen(slotCount, orders, menuById, now) {
  slotCount = Math.max(1, slotCount | 0);
  const slots = new Array(slotCount).fill(-Infinity);
  const earliest = () => slots.indexOf(Math.min(...slots));
  const batches = (o) => o.items.flatMap((it) => {
    const m = menuById[it.menu_item_id] || { cook_time_sec: 0, max_at_once: 1 };
    const n = Math.ceil(it.qty / Math.max(1, m.max_at_once));
    return Array.from({ length: n }, () => m.cook_time_sec * 1000);
  });

  const preparing = orders.filter((o) => o.status === 'preparing').sort((a, b) => a.preparing_at - b.preparing_at);
  const waiting = orders.filter((o) => o.status === 'placed').sort((a, b) => a.created_at - b.created_at);
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

  const active = preparing.concat(waiting);
  for (const o of active) {
    const ahead = active.filter((x) => x.id !== o.id && x.created_at < o.created_at);
    out[o.id].ahead = ahead.length;
    out[o.id].dishesAhead = sum(ahead, (x) => sum(x.items, (i) => i.qty));
  }
  return out;
}

// Estimate for an order that hasn't been placed yet (store cards, checkout)
function estimateNew(slotCount, orders, lines, menuById, now) {
  const probe = { id: '__new', status: 'placed', created_at: now + 1, items: lines };
  return scheduleKitchen(slotCount, orders.concat([probe]), menuById, now).__new;
}

module.exports = { round2, sum, scheduleKitchen, estimateNew };
