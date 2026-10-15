// Peer delivery data. The only file that queries deliveries, except that
// orders.repository.create saves a new order's delivery together with the order.
const supabase = require('../common/supabase');

// A delivery with the order it belongs to (and how many items that order has)
const WITH_ORDER = '*, orders(id, student_id, store_id, status, type, delivery_fee, created_at, ready_at, order_items(qty))';

// Deliveries with this status, oldest first. `since` (ISO time) keeps only those that expire after it.
exports.findByStatus = async (status, { since } = {}) => {
  let query = supabase.from('deliveries').select(WITH_ORDER).eq('status', status).order('created_at');
  if (since) query = query.gte('expires_at', since);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// Every delivery this student has taken on, newest first
exports.findByCourier = async (courierId) => {
  const { data, error } = await supabase
    .from('deliveries')
    .select(WITH_ORDER)
    .eq('courier_id', courierId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

exports.findById = async (deliveryId) => {
  const { data, error } = await supabase.from('deliveries').select(WITH_ORDER).eq('id', deliveryId).maybeSingle();

  if (error) throw error;
  return data;
};

// Open deliveries whose 10-minute window has passed
exports.findOverdue = async (nowIso) => {
  const { data, error } = await supabase.from('deliveries').select('id, order_id').eq('status', 'open').lt('expires_at', nowIso);

  if (error) throw error;
  return data;
};

// The delivery this courier is in the middle of, or null
exports.findActiveForCourier = async (courierId) => {
  const { data, error } = await supabase
    .from('deliveries')
    .select('id')
    .eq('courier_id', courierId)
    .in('status', ['accepted', 'picked_up'])
    .limit(1);

  if (error) throw error;
  return data[0] || null;
};

// Change a delivery only if it still has the status we expect (two couriers can't both accept a job).
// Returns the saved row, or null when someone else got there first.
exports.update = async (deliveryId, fromStatus, changes) => {
  const { data, error } = await supabase
    .from('deliveries')
    .update(changes)
    .eq('id', deliveryId)
    .eq('status', fromStatus)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};
