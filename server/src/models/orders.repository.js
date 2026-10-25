// Order data. The ONLY file that queries orders, order_items and payments.
const supabase = require('../common/supabase');

// Everything a screen needs about an order, nested:
//   profiles(name)                     the student who ordered
//   order_items(*, menu_items(name))   each item with its dish name
//   payments(...)                      a list; orders has no total, so what was paid is payments[0].amount
//   deliveries(*, profiles(name))      a list with at most one delivery, and its courier's name
const DETAIL = '*, profiles(name), order_items(*, menu_items(name)), payments(amount, status, reference, method), deliveries(*, profiles(name))';

// Saves an order, its items, its payment and (for peer delivery) its delivery.
// If a later insert fails, the order is removed again so nothing is half saved.
exports.create = async ({ order, items, payment, delivery }) => {
  const { data: saved, error } = await supabase.from('orders').insert(order).select().single();
  if (error) throw error;

  const itemRows = items.map((item) => ({ ...item, order_id: saved.id }));
  const { data: savedItems, error: itemsError } = await supabase.from('order_items').insert(itemRows).select();
  if (itemsError) {
    await removeOrder(saved.id);
    throw itemsError;
  }

  const { data: savedPayment, error: paymentError } = await supabase
    .from('payments')
    .insert({ ...payment, order_id: saved.id })
    .select()
    .single();
  if (paymentError) {
    await removeOrder(saved.id);
    throw paymentError;
  }

  let savedDelivery = null;
  if (delivery) {
    const { data, error: deliveryError } = await supabase
      .from('deliveries')
      .insert({ ...delivery, order_id: saved.id })
      .select()
      .single();
    if (deliveryError) {
      await removeOrder(saved.id);
      throw deliveryError;
    }
    savedDelivery = data;
  }

  return { ...saved, order_items: savedItems, payment: savedPayment, delivery: savedDelivery };
};

async function removeOrder(orderId) {
  await supabase.from('payments').delete().eq('order_id', orderId);
  await supabase.from('order_items').delete().eq('order_id', orderId);
  await supabase.from('orders').delete().eq('id', orderId);
}

// A store's orders, newest first (see DETAIL for what's nested)
exports.findByStore = async (storeId) => {
  const { data, error } = await supabase
    .from('orders')
    .select(DETAIL)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// A student's orders, newest first
exports.findByStudent = async (studentId) => {
  const { data, error } = await supabase
    .from('orders')
    .select(DETAIL)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// One order, or null
exports.findById = async (orderId) => {
  const { data, error } = await supabase.from('orders').select(DETAIL).eq('id', orderId).maybeSingle();

  if (error) throw error;
  return data;
};

// Every order still waiting or cooking, with just what the wait-time engine needs
exports.findActive = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select('id, store_id, status, created_at, paid_at, order_items(menu_item_id, qty)')
    .in('status', ['paid', 'preparing'])
    .order('created_at');

  if (error) throw error;
  return data;
};

// Change an order only if it still has the status we expect, so two clicks can't both win.
// Returns the saved row, or null when the order had already moved on.
exports.updateStatus = async (orderId, fromStatus, changes) => {
  const { data, error } = await supabase
    .from('orders')
    .update(changes)
    .eq('id', orderId)
    .eq('status', fromStatus)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

// Change any columns of an order (e.g. switch an expired delivery to pickup)
exports.update = async (orderId, changes) => {
  const { data, error } = await supabase.from('orders').update(changes).eq('id', orderId).select().maybeSingle();

  if (error) throw error;
  return data;
};

// Angel: active orders from a store created before the given order (all active when order is null)
exports.findOrdersAhead = async (storeId, order) => {
  let query = supabase
    .from("orders")
    .select("id,created_at,store_id,status,order_items(id, menu_item_id, qty)")
    .eq("store_id", storeId)
    .not('status', 'in', '("ready","completed","cancelled")'); // orders not done yet

  if (order) {
    query = query.lte("created_at", order.created_at);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) throw error;
  return data;
};
