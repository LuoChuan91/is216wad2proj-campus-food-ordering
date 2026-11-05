
const service = require('../services/orders.service');
const deliveriesService = require('../services/deliveries.service');

exports.postOrder = async (req, res) => {
  const order = await service.placeOrder(req.body);
  res.status(201).json(order);
};

// GET /api/orders?store_id=<id> (a store's orders) or ?student_id=<id> (a student's orders)
exports.getOrderList = async (req, res) => {
  await deliveriesService.expireOverdue(); // late deliveries switch to pickup before anyone sees them
  const orders = req.query.student_id
    ? await service.listStudentOrders(req.query.student_id)
    : await service.listOrders(req.query.store_id);
  res.json(orders);
};

exports.getPreviousOrders = async (req, res) => {
  const orders = await service.listPreviousOrders(req.query.student_id);
  res.json(orders);
};

exports.getOrder = async (req, res) => {
  await deliveriesService.expireOverdue();
  const order = await service.getOrder(req.params.id);
  res.json(order);
};

// PATCH /api/orders/:id  { "status": "preparing" | "ready" | "completed" }
exports.patchOrder = async (req, res) => {
  const order = await service.updateStatus(req.params.id, req.body && req.body.status);
  res.json(order);
};

// Angel: orders ahead of a given order, used by the wait-time estimate
exports.getOrderAhead = async (req, res) => {
  const orders = await service.getOrderAhead(req.query.store_id, req.query.order_id);
  res.json(orders);
};
