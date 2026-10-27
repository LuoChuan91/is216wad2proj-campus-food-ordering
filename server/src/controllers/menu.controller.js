
const service = require('../services/menu.service');

// GET /api/menu (every dish) or /api/menu?store_id=<id> (one store's menu)
exports.listMenu = async (req, res) => {
  const items = await service.listMenu({ storeId: req.query.store_id });
  res.json(items);
};

exports.getMenuItem = async (req, res) => {
  const item = await service.getMenuItem(req.params.id);
  res.json(item);
};

// POST /api/menu  { store_id, name, price, category, cook_time_sec, max_at_once, ... }
exports.createMenuItem = async (req, res) => {
  const item = await service.createMenuItem(req.body, req.get('x-user-id'));
  res.status(201).json(item);
};

// PATCH /api/menu/:id  { "available": false }, { "price": 6.5 }, ...
exports.patchMenuItem = async (req, res) => {
  const item = await service.updateMenuItem(req.params.id, req.body, req.get('x-user-id'));
  res.json(item);
};

// DELETE /api/menu/:id
exports.deleteMenuItem = async (req, res) => {
  const result = await service.deleteMenuItem(req.params.id, req.get('x-user-id'));
  res.json(result);
};

// Angel: cooking details used by the wait-time estimate
exports.getCookingDetdails = async (req, res) => {
  const item = await service.getCookingDetails(req.body.ids);
  res.json(item);
};
