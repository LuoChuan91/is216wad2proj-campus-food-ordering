
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
  return repository.findByStore(storeId);
};

exports.placeOrder = async (body) => {
  throw httpError(501, 'placeOrder is not written yet');
};
