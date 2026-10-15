
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

// PATCH /api/menu/:id  { "available": false }
exports.patchMenuItem = async (req, res) => {
  const item = await service.updateMenuItem(req.params.id, req.body);
  res.json(item);
};
