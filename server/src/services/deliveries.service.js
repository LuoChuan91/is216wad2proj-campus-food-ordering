const repository = require('../models/deliveries.repository');
const ordersRepository = require('../models/orders.repository');
const profilesRepository = require('../models/profiles.repository');

// A courier can carry several deliveries at once (pick up along the way).
const MAX_ACTIVE_JOBS = 4;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// What the Deliver screen shows for a job
function jobView(d) {
  const o = d.orders || {};
  return {
    id: d.id, order_id: d.order_id, status: d.status, courier_id: d.courier_id,
    pickup_store_id: d.pickup_store_id, destination_id: d.destination_id, note: d.note,
    fee: Number(d.fee), created_at: d.created_at, expires_at: d.expires_at,
    accepted_at: d.accepted_at, picked_up_at: d.picked_up_at, delivered_at: d.delivered_at,
    order: {
      id: o.id, code: String(o.id || '').slice(0, 4).toUpperCase(), student_id: o.student_id, store_id: o.store_id,
      status: o.status, ready_at: o.ready_at, items: (o.order_items || []).reduce((n, i) => n + i.qty, 0),
    },
  };
}

// The 10-minute rule: a delivery nobody accepted in time becomes a pickup and the fee is waived.
// There's no scheduled job, so this runs whenever orders or deliveries are read.
exports.expireOverdue = async () => {
  const overdue = await repository.findOverdue(new Date().toISOString());
  for (const d of overdue) {
    const expired = await repository.update(d.id, 'open', { status: 'expired' });
    if (expired) await ordersRepository.update(d.order_id, { type: 'pickup', delivery_fee: null });
  }
  return overdue.length;
};

// ?status=open: jobs waiting for a courier. ?status=expired: jobs that expired in the last 5 minutes.
exports.listByStatus = async (status) => {
  if (status === 'open') return (await repository.findByStatus('open')).map(jobView);
  if (status === 'expired') {
    const since = new Date(Date.now() - 5 * 60e3).toISOString();
    return (await repository.findByStatus('expired', { since })).map(jobView);
  }
  throw httpError(400, 'status must be open or expired');
};

exports.listForCourier = async (courierId) => {
  if (!courierId) throw httpError(400, 'courier_id is required');
  return (await repository.findByCourier(courierId)).map(jobView);
};

// A student courier accepts a job, picks the food up, then delivers it
exports.act = async (deliveryId, { action, courier_id: courierId } = {}) => {
  if (!['accept', 'pickup', 'deliver'].includes(action)) throw httpError(400, 'action must be accept, pickup or deliver');
  if (!courierId) throw httpError(400, 'courier_id is required');

  const courier = await profilesRepository.findById(courierId);
  if (!courier || courier.role !== 'student') throw httpError(403, 'Only students can deliver');
  if (courier.status !== 'active') throw httpError(403, 'This account is not active');

  const d = await repository.findById(deliveryId);
  if (!d) throw httpError(404, 'Delivery not found');
  const now = new Date().toISOString();
  let saved;

  if (action === 'accept') {
    if (d.status !== 'open') throw httpError(409, 'Someone else already took this job');
    if (Date.parse(d.expires_at) < Date.now()) throw httpError(409, 'This job has expired');
    if (d.orders && d.orders.student_id === courierId) throw httpError(400, "You can't deliver your own order");
    if (await repository.countActiveForCourier(courierId) >= MAX_ACTIVE_JOBS) throw httpError(409, `You can carry at most ${MAX_ACTIVE_JOBS} jobs at once`);
    saved = await repository.update(deliveryId, 'open', { status: 'accepted', courier_id: courierId, accepted_at: now });
    if (!saved) throw httpError(409, 'Someone else already took this job');
  } else {
    if (d.courier_id !== courierId) throw httpError(403, 'This is not your delivery');
    if (action === 'pickup') {
      if (d.status !== 'accepted') throw httpError(409, `This delivery is ${d.status}`);
      if (!d.orders || d.orders.status !== 'ready') throw httpError(409, "The food isn't ready yet");
      saved = await repository.update(deliveryId, 'accepted', { status: 'picked_up', picked_up_at: now });
    } else {
      if (d.status !== 'picked_up') throw httpError(409, 'Pick the food up first');
      saved = await repository.update(deliveryId, 'picked_up', { status: 'delivered', delivered_at: now });
      if (saved) await ordersRepository.update(d.order_id, { status: 'completed', completed_at: now });
    }
    if (!saved) throw httpError(409, 'This delivery just changed. Refresh and try again.');
  }

  return jobView(await repository.findById(deliveryId));
};

// The student stops waiting for a courier and collects the order themselves. Only while the job
// is still open (nobody accepted yet). Same result as the 10-minute rule: the delivery ends as
// 'expired', the order becomes a pickup and the delivery fee is waived.
exports.switchToPickup = async (deliveryId, studentId) => {
  if (!studentId) throw httpError(400, 'student_id is required');

  const d = await repository.findById(deliveryId);
  if (!d) throw httpError(404, 'Delivery not found');
  if (!d.orders || d.orders.student_id !== studentId) throw httpError(403, 'This is not your order');
  if (d.status === 'expired') throw httpError(409, 'This order is already a pickup');
  if (d.status !== 'open') throw httpError(409, 'A courier has already accepted this delivery');
  if (['completed', 'cancelled'].includes(d.orders.status)) throw httpError(409, `This order is ${d.orders.status}`);

  // expires_at = now, so the courier's "expired jobs" list shows when it really ended
  const saved = await repository.update(deliveryId, 'open', { status: 'expired', expires_at: new Date().toISOString() });
  if (!saved) throw httpError(409, 'A courier just accepted this delivery. Refresh to see who.');
  await ordersRepository.update(d.order_id, { type: 'pickup', delivery_fee: null });

  return jobView(await repository.findById(deliveryId));
};

// "Where is my rider": the courier's phone sends its GPS fix every few seconds while a job is
// in progress, and the student's tracking page reads the latest one.
// ponytail: kept in memory, so a restart forgets fixes (the page falls back to an estimate) and
// several server instances wouldn't share them. Move to a deliveries column if the server scales out.
const locations = new Map();
const SHARING = ['accepted', 'picked_up'];

exports.saveLocation = async (deliveryId, { courier_id: courierId, lat, lng, accuracy } = {}) => {
  const la = Number(lat), ln = Number(lng);
  if (lat == null || lng == null || !Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) {
    throw httpError(400, 'lat and lng must be valid coordinates');
  }
  if (!courierId) throw httpError(400, 'courier_id is required');

  const d = await repository.findById(deliveryId);
  if (!d) throw httpError(404, 'Delivery not found');
  if (d.courier_id !== courierId) throw httpError(403, 'This is not your delivery');
  if (!SHARING.includes(d.status)) throw httpError(409, `This delivery is ${d.status}`);

  const acc = Number(accuracy);
  const fix = { lat: la, lng: ln, accuracy: accuracy != null && Number.isFinite(acc) ? Math.round(acc) : null, at: new Date().toISOString() };
  locations.set(deliveryId, fix);
  return fix;
};

// The courier's last fix, only while the delivery is in progress (sharing stops once it's delivered)
exports.getLocation = async (deliveryId) => {
  const d = await repository.findById(deliveryId);
  if (!d) throw httpError(404, 'Delivery not found');
  if (!SHARING.includes(d.status)) {
    locations.delete(deliveryId);
    return { status: d.status, location: null };
  }
  return { status: d.status, location: locations.get(deliveryId) || null };
};
