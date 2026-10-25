const service = require('../services/deliveries.service');

// GET /api/deliveries?status=open | ?status=expired | ?courier_id=<id>
exports.listDeliveries = async (req, res) => {
  await service.expireOverdue();
  const jobs = req.query.courier_id
    ? await service.listForCourier(req.query.courier_id)
    : await service.listByStatus(req.query.status || 'open');
  res.json(jobs);
};

// PATCH /api/deliveries/:id  { "action": "accept" | "pickup" | "deliver", "courier_id": "<profile id>" }
exports.patchDelivery = async (req, res) => {
  await service.expireOverdue();
  const job = await service.act(req.params.id, req.body);
  res.json(job);
};
