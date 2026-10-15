
const service = require('../services/orders.service');

exports.postOrder = async (req, res) => {
  const order = await service.placeOrder(req.body);
  res.status(201).json(order);
};

exports.getOrderList = async (req, res) => {
  const orders = await service.listOrders(req.query.store_id);
  res.json(orders);
};

// retrieve orders for wait time estimation
exports.getOrderAhead = async (req, res) => {
  const orders = await service.getOrderAhead(req.query.store_id, req.query.order_id)
  res.json(orders)
}
