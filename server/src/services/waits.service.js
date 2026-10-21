// Wait times: runs the kitchen engine (common/engine.js) over every store's live queue.
const ordersRepository = require('../models/orders.repository');
const menuRepository = require('../models/menu.repository');
const storesRepository = require('../models/stores.repository');
const ordersService = require('./orders.service');
const { scheduleKitchen, estimateNew } = require('../common/engine');
const { KITCHEN_SLOTS } = require('../common/config');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const minutesUntil = (now, at) => Math.max(1, Math.ceil((at - now) / 60000));

// The engine's shape: times in ms, and 'placed' for orders that haven't started cooking
function toKitchen(o) {
  const startedAt = ordersService.preparingStartedAt(o.id) || Date.parse(o.paid_at || o.created_at);
  return {
    id: o.id,
    status: o.status === 'preparing' ? 'preparing' : 'placed',
    created_at: Date.parse(o.created_at),
    preparing_at: startedAt,
    items: o.order_items || [],
  };
}

async function load() {
  const [stores, menu, orders] = await Promise.all([
    storesRepository.findAll({}),
    menuRepository.findCookDetails(),
    ordersRepository.findActive(),
  ]);
  const menuById = Object.fromEntries(menu.map((m) => [m.id, m]));
  return { stores, menu, orders, menuById };
}

// { now, slots,
//   stores: { [storeId]: { minutes, ahead, readyAt } }   the wait for one dish ordered now
//   orders: { [orderId]: { readyAt, ahead, dishesAhead } } every order still waiting or cooking }
exports.getWaitTimes = async () => {
  const now = Date.now();
  const { stores, menu, orders, menuById } = await load();
  const out = { now, slots: KITCHEN_SLOTS, stores: {}, orders: {} };

  for (const store of stores) {
    const kitchen = orders.filter((o) => o.store_id === store.id).map(toKitchen);
    Object.assign(out.orders, scheduleKitchen(KITCHEN_SLOTS, kitchen, menuById, now));
    const first = menu.find((m) => m.store_id === store.id && m.available);
    if (first) {
      const est = estimateNew(KITCHEN_SLOTS, kitchen, [{ menu_item_id: first.id, qty: 1 }], menuById, now);
      out.stores[store.id] = { minutes: minutesUntil(now, est.readyAt), ahead: est.ahead, readyAt: est.readyAt };
    } else {
      out.stores[store.id] = { minutes: null, ahead: kitchen.length, readyAt: null };
    }
  }
  return out;
};

// When an order that isn't placed yet would be ready. body: { store_id, items: [{ menu_item_id, qty }] }
exports.estimate = async (body = {}) => {
  if (!body.store_id || !Array.isArray(body.items) || body.items.length === 0) throw httpError(400, 'store_id and items are required');
  const now = Date.now();
  const { orders, menuById } = await load();
  const lines = body.items.map((i) => ({ menu_item_id: i.menu_item_id, qty: Math.max(1, Number(i.qty) || 1) }));
  const kitchen = orders.filter((o) => o.store_id === body.store_id).map(toKitchen);
  const est = estimateNew(KITCHEN_SLOTS, kitchen, lines, menuById, now);
  return { ...est, minutes: minutesUntil(now, est.readyAt), now };
};
