const service = require('../services/waits.service');

// GET /api/wait-times
exports.getWaitTimes = async (req, res) => {
  res.json(await service.getWaitTimes());
};

// POST /api/wait-times/estimate  { "store_id": "<id>", "items": [{ "menu_item_id": "<id>", "qty": 1 }] }
exports.postEstimate = async (req, res) => {
  res.json(await service.estimate(req.body));
};
