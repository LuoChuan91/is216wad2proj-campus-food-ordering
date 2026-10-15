// Order data. The ONLY file that queries orders, order_items and payments.
const supabase = require('../common/supabase');

exports.create = async ({ order, items, payment }) => {
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

  return { ...saved, order_items: savedItems, payment: savedPayment };
};

async function removeOrder(orderId) {
  await supabase.from('order_items').delete().eq('order_id', orderId);
  await supabase.from('orders').delete().eq('id', orderId);
}

// A store's orders, newest first, each with its items and payment nested.
// orders has no total column, so the amount the student paid comes from payments.
exports.findByStore = async (storeId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), payments(amount, status, reference)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// use to retrive orders form a store for time estimation, optional parameter for order id 
// for order tracking page()
exports.findOrdersAhead = async (storeId, orderId) => {
  // select request order, null if orderID not provided
  console.log(storeId, orderId)
  const {dataTarget, errorTarget} = await supabase
    .from('orders')
    .select()
    .eq('store_id', storeId)
    .single();
    console.log(dataTarget)
    console.log(errorTarget)

  // retrieve orders from a store that is created earlier then requested order
  // retrieve all if requested order is null
  // const { data, error } = await supabase
  //   .from('orders')
  //   .select('*, order_items(*)')
  //   .eq('store_id', storeId)
  //   .lte('created_at', dataTarget.created_at)
  //   .order('created_at', { ascending: true });

  // if (error) throw error;
  return dataTarget;
};