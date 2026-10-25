const repository = require('../models/orders.repository');
const menuRepository = require('../models/menu.repository');
const storesRepository = require('../models/stores.repository');
const profilesRepository = require('../models/profiles.repository');
const venuesRepository = require('../models/venues.repository');
const { round2 } = require('../common/engine');
const { DELIVERY_FEE, DELIVERY_WINDOW_MIN } = require('../common/config');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// orders has no preparing_at column yet, so the server remembers when each order started cooking
// (until it restarts). The wait-time engine uses this; without it, it falls back to paid_at.
const preparingStartedAt = new Map();
exports.preparingStartedAt = (orderId) => preparingStartedAt.get(orderId);

// order_items.selected_options only holds option ids, so look up all their names in one
// query and add them to each item as option_names, e.g. ['White Rice', 'Add Tamago']
async function withOptionNames(orders) {
  const optionIds = [...new Set(orders.flatMap((order) => (order.order_items || []).flatMap((item) => item.selected_options || [])))];
  const names = new Map((await menuRepository.findOptionNames(optionIds)).map((option) => [option.id, option.name]));

  return orders.map((order) => ({
    ...order,
    order_items: (order.order_items || []).map((item) => ({
      ...item,
      option_names: (item.selected_options || []).map((id) => names.get(id)).filter(Boolean),
    })),
  }));
}

// Adds what the screens show but the database doesn't store:
//   code         a short order number, e.g. "E287"
//   total        what the order costs now (what was paid, minus a waived delivery fee)
//   discount     the store discount, worked out from subtotal + fee - paid
//   fallback     true when no courier took the delivery in time, so it became a pickup
//   payment, delivery   the first row of payments / deliveries, or null
function summarise(order) {
  const payment = (order.payments || [])[0] || null;
  const d = (order.deliveries || [])[0] || null;
  const subtotal = Number(order.subtotal);
  const fallback = !!d && d.status === 'expired';
  const feeCharged = fallback ? Number(d.fee) : Number(order.delivery_fee || 0);
  const paid = payment ? Number(payment.amount) : round2(subtotal + feeCharged);
  const feeWaived = fallback ? Number(d.fee) : 0;

  return {
    ...order,
    code: String(order.id).slice(0, 4).toUpperCase(),
    student_name: order.profiles ? order.profiles.name : null,
    subtotal,
    delivery_fee: order.delivery_fee == null ? null : Number(order.delivery_fee),
    discount: round2(Math.max(0, subtotal + feeCharged - paid)),
    paid,
    fee_waived: feeWaived,
    total: round2(paid - feeWaived),
    fallback,
    preparing_at: preparingStartedAt.has(order.id) ? new Date(preparingStartedAt.get(order.id)).toISOString() : null,
    payment,
    delivery: d && { ...d, fee: Number(d.fee), courier_name: d.profiles ? d.profiles.name : null },
  };
}

async function present(orders) {
  return (await withOptionNames(orders)).map(summarise);
}

exports.listOrders = async (storeId) => {
  if (!storeId) throw httpError(400, 'store_id is required, e.g. /api/orders?store_id=<id>');
  return present(await repository.findByStore(storeId));
};

exports.listStudentOrders = async (studentId) => {
  if (!studentId) throw httpError(400, 'student_id is required, e.g. /api/orders?student_id=<id>');
  return present(await repository.findByStudent(studentId));
};

exports.getOrder = async (orderId) => {
  const order = await repository.findById(orderId);
  if (!order) throw httpError(404, 'Order not found');
  return (await present([order]))[0];
};

exports.placeOrder = async (body) => {
  let store;
  const lines = [];
  if (!body.student_id || !Array.isArray(body.items) || body.items.length === 0) throw httpError(400, 'no student id, or items selected');

  const type = body.type || 'pickup';
  if (type !== 'pickup' && type !== 'delivery') throw httpError(400, 'type must be pickup or delivery');

  const student = await profilesRepository.findById(body.student_id);
  if (!student || student.role !== 'student') throw httpError(400, 'Only student accounts can order');
  if (student.status !== 'active') throw httpError(403, 'This account is not active yet');

  for (let i of body.items) {
    if (!Number.isInteger(i.qty) || i.qty < 1) throw httpError(400, 'quantity must be at least 1');

    let item = await menuRepository.findItemWithOptions(i.menu_item_id)
    if (!item || item.is_archived) throw httpError(404, `Menu item ${i.menu_item_id} not found`);

    if (store && item.store_id !== store.id) throw httpError(400, 'All items in one order must come from the same store');
    store = await storesRepository.findById(item.store_id)
    if (!store.is_open) throw httpError(400, `${store.name} is not opened`);
    if (!item.available) throw httpError(400, `${item.name} is not available`);

    const chosenIds = i.option_ids || []
    const validIds = item.option_groups.flatMap(group => group.options.map(o => o.id));
    for (let option of chosenIds) {
      if (!validIds.includes(option)) throw httpError(400, `${option} isn't on ${item.name}`)
    }

    for (let group of item.option_groups) {
      let option_count = 0
      let min = group.required ? Math.max(1, group.min_select) : group.min_select;
      for (let option of group.options) {
        if (chosenIds.includes(option.id)) {
          option_count += 1
        }
      }
      if (option_count < min || option_count > group.max_select) throw httpError(400, `${group.name}: pick ${min} to ${group.max_select}`)
    }

    let dish_options = item.option_groups.flatMap(group => group.options).filter(option => chosenIds.includes(option.id));
    let soldOut = dish_options.find(o => o.available === false)
    if (soldOut) throw httpError(400, `${soldOut.name} is not available!`);

    let unit_price = 0;
    unit_price += Number(item.price)
    for (let option of dish_options) {
      unit_price += Number(option.price_delta)
    }
    lines.push({ menu_item_id: i.menu_item_id, qty: i.qty, unit_price: round2(unit_price), selected_options: dish_options.map(o => o.id)})
  }

  // Peer delivery: check the drop-off point, and open a delivery job with a 10-minute window
  let delivery = null;
  if (type === 'delivery') {
    if (!body.destination_id) throw httpError(400, 'Choose where the food should be delivered');
    const destination = await venuesRepository.findDestinationById(body.destination_id);
    if (!destination) throw httpError(400, 'That drop-off point does not exist');
    delivery = {
      pickup_store_id: store.id,
      destination_id: destination.id,
      note: String(body.note || '').trim().slice(0, 80) || null,
      fee: DELIVERY_FEE,
      status: 'open',
      expires_at: new Date(Date.now() + DELIVERY_WINDOW_MIN * 60e3).toISOString(),
    };
  }

  // pickup orders have no fee (the database requires NULL), delivery orders have one
  let delivery_fee = type === 'delivery' ? DELIVERY_FEE : null
  let subtotal = round2(lines.reduce((sum, item) => { return sum + item.unit_price*item.qty }, 0));
  let discount;
  if (store.discount_type === 'percentage') {
    discount = Math.round(subtotal * store.discount_per / 100 * 100) / 100
  } else {
    discount = (store.discount_type === 'dollar') ? Number(store.discount_dol) : 0
  }
  // the discount is for the food only, never the delivery fee
  let total = round2(Math.max(subtotal - discount, 0) + (delivery_fee || 0))
  return repository.create({
          order:   { student_id: body.student_id, store_id: store.id, type, status: 'paid', paid_at: new Date().toISOString(), subtotal, delivery_fee},
          items: lines,
          payment: { amount: total, method: 'simulated', status: 'success', reference: `SIM-${Date.now()}`},
          delivery,
  });
};

// The kitchen moves an order along: paid -> preparing -> ready -> completed (collected).
// Delivery orders are completed by the courier instead (see deliveries.service.js).
const NEXT = { paid: 'preparing', preparing: 'ready', ready: 'completed' };

exports.updateStatus = async (orderId, status) => {
  const order = await repository.findById(orderId);
  if (!order) throw httpError(404, 'Order not found');
  if (NEXT[order.status] !== status) throw httpError(409, `A ${order.status} order can't become ${status}`);
  if (status === 'completed' && order.type === 'delivery') throw httpError(409, 'The courier completes delivery orders when they drop them off');

  const now = new Date().toISOString();
  const changes = { status };
  if (status === 'ready') changes.ready_at = now;
  if (status === 'completed') changes.completed_at = now;

  const saved = await repository.updateStatus(orderId, order.status, changes);
  if (!saved) throw httpError(409, 'This order just changed. Refresh and try again.');
  if (status === 'preparing') preparingStartedAt.set(orderId, Date.now());
  return exports.getOrder(orderId);
};

// orders from a store that were created before the given order (or all active ones).
// Returns { orders, ahead } where `ahead` is the count the frontend wait-time engine
// surfaces as "N orders ahead". `orders` is kept so the client can also compute the
// cook-time estimate from the queue's items.
exports.getOrderAhead = async (storeId, orderId) => {
  // orderId is allowed to be null
  if (!storeId) throw httpError(400, 'store_id is required, e.g. /api/orders/orderAhead?store_id=<id>');
  let order;
  if (orderId) order = await repository.findById(orderId);
  const orders = await repository.findOrdersAhead(storeId, order);
  return { orders, ahead: orders.length };
};
