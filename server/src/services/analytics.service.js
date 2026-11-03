const ordersRepository = require('../models/orders.repository');
const storesRepository = require('../models/stores.repository');
const profilesRepository = require('../models/profiles.repository');
const { round2 } = require('../common/engine');

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;
const DEFAULT_DAYS = 7;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const localDate = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
const startOf = (date) => Date.parse(`${date}T00:00:00+08:00`);

function parseRange(from, to, now) {
  const end = to || localDate(now);
  const start = from || localDate(startOf(end) - (DEFAULT_DAYS - 1) * DAY_MS);
  for (const d of [start, end]) {
    if (!DATE.test(d) || Number.isNaN(startOf(d)) || localDate(startOf(d)) !== d) throw httpError(400, `Dates must look like 2026-11-04, got "${d}"`);
  }
  const days = Math.round((startOf(end) - startOf(start)) / DAY_MS) + 1;
  if (days < 1) throw httpError(400, '"from" must be on or before "to"');
  if (days > MAX_DAYS) throw httpError(400, `Pick a range of ${MAX_DAYS} days or fewer`);
  return { from: start, to: end, days };
}

function earningsOf(order) {
  const payment = (order.payments || [])[0];
  const delivery = (order.deliveries || [])[0];
  const subtotal = Number(order.subtotal);
  const fee = delivery && delivery.status === 'expired' ? Number(delivery.fee) : Number(order.delivery_fee || 0);
  const paid = payment ? Number(payment.amount) : subtotal + fee;
  return Math.max(0, paid - fee);
}

function waitMinutesOf(order) {
  if (!order.paid_at || !order.ready_at) return null;
  const ms = Date.parse(order.ready_at) - Date.parse(order.paid_at);
  return ms >= 0 ? ms / 60000 : null;
}

const average = (values) => (values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : null);

async function assertCanView(store, actorId) {
  if (!actorId) throw httpError(401, 'Sign in to see analytics');
  const actor = await profilesRepository.findById(actorId);
  if (!actor || actor.status !== 'active') throw httpError(401, 'Sign in to see analytics');
  if (actor.role === 'admin') return;
  if (actor.role !== 'merchant' || store.merchant_id !== actor.id) throw httpError(403, "You can only see your own store's analytics");
}

exports.getStoreAnalytics = async (storeId, { from, to } = {}, actorId, now = Date.now()) => {
  const store = await storesRepository.findById(storeId);
  if (!store) throw httpError(404, 'Store not found');
  await assertCanView(store, actorId);

  const range = parseRange(from, to, now);
  const orders = await ordersRepository.findForAnalytics(
    storeId,
    new Date(startOf(range.from)).toISOString(),
    new Date(startOf(range.to) + DAY_MS).toISOString(),
  );

  const daily = Array.from({ length: range.days }, (_, i) => ({ date: localDate(startOf(range.from) + i * DAY_MS), orders: 0, earnings: 0, waits: [] }));
  const byDate = new Map(daily.map((d) => [d.date, d]));
  for (const order of orders) {
    const day = byDate.get(localDate(Date.parse(order.created_at)));
    if (!day) continue;
    day.orders += 1;
    day.earnings += earningsOf(order);
    const wait = waitMinutesOf(order);
    if (wait !== null) day.waits.push(wait);
  }

  const allWaits = daily.flatMap((d) => d.waits);
  return {
    store_id: storeId,
    from: range.from,
    to: range.to,
    earnings: round2(daily.reduce((n, d) => n + d.earnings, 0)),
    orders: daily.reduce((n, d) => n + d.orders, 0),
    avg_wait_min: average(allWaits),
    daily: daily.map(({ waits, ...d }) => ({ ...d, earnings: round2(d.earnings), avg_wait_min: average(waits) })),
  };
};
