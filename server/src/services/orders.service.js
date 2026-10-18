
const repository = require('../models/orders.repository');
const menuRepository = require('../models/menu.repository');
const storesRepository = require('../models/stores.repository');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

exports.listOrders = async (storeId) => {
  if (!storeId) throw httpError(400, 'store_id is required, e.g. /api/orders?store_id=<id>');
  const orders = await repository.findByStore(storeId);

  // order_items.selected_options only holds option ids, so look up all their names in one
  // query and add them to each item as option_names, e.g. ['White Rice', 'Add Tamago']
  const optionIds = [...new Set(orders.flatMap((order) => order.order_items.flatMap((item) => item.selected_options || [])))];
  const names = new Map((await menuRepository.findOptionNames(optionIds)).map((option) => [option.id, option.name]));

  return orders.map((order) => ({
    ...order,
    order_items: order.order_items.map((item) => ({
      ...item,
      option_names: (item.selected_options || []).map((id) => names.get(id)).filter(Boolean),
    })),
  }));
};

exports.placeOrder = async (body) => {
  let store;
  const lines = [];
  if (!body.student_id || !Array.isArray(body.items) || body.items.length === 0) throw httpError(400, 'no student id, or items selected');
  for (let i of body.items) {
    if (!Number.isInteger(i.qty) || i.qty < 1) throw httpError(400, 'quantity must be at least 1');

    let item = await menuRepository.findItemWithOptions(i.menu_item_id)
    if (!item || item.is_archived) throw httpError(404, `Menu item ${i.menu_item_id} not found`);

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
    lines.push({ menu_item_id: i.menu_item_id, qty: i.qty, unit_price, selected_options: dish_options.map(o => o.id)})
  }

  let delivery_fee = null
  let subtotal = lines.reduce((sum, item) => { return sum + item.unit_price*item.qty }, 0);
  let discount;
  if (store.discount_type === 'percentage') {
    discount = Math.round(subtotal * store.discount_per / 100 * 100) / 100
  } else {
    discount = (store.discount_type === 'dollar') ? store.discount_dol : 0
  }
  let total = Math.max(subtotal - discount, 0)
  return repository.create({
          order:   { student_id: body.student_id, store_id: store.id, type: 'pickup', status: 'paid', paid_at: new Date().toISOString(), subtotal, delivery_fee},
          items: lines, 
          payment: { amount: total, method: 'simulated', status: 'success', reference: `SIM-${Date.now()}`},
  });
};


exports.getOrderAhead = async (storeId, orderId) => {
  // orderId allow to be null
  if (!storeId) throw httpError(400, 'store_id is required, e.g. /api/orders/orderAhead?store_id=<id>');
  let order;
  // if orderId is provided
  if(orderId){
    order = await repository.findById(orderId)
  }
  return repository.findOrdersAhead(storeId, order);
}