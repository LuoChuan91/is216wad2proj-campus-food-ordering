const service = require('../services/menu.service');

exports.postOrder = async (req, res) => {
  const order = await service.placeOrder(req.body);
  res.status(201).json(order);
};