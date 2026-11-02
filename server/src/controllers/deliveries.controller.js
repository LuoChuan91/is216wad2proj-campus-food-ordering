const service = require('../services/deliveries.service');

// GET /api/deliveries?status=open | ?status=expired | ?courier_id=<id>
exports.listDeliveries = async (req, res) => {
  await service.expireOverdue();
  const jobs = req.query.courier_id
    ? await service.listForCourier(req.query.courier_id)
    : await service.listByStatus(req.query.status || 'open');
  res.json(jobs);
};

// PATCH /api/deliveries/:id
//   courier: { "action": "accept" | "pickup" | "deliver", "courier_id": "<profile id>" }
//   student: { "action": "switch_to_pickup", "student_id": "<profile id>" }  (only before a courier accepts)
exports.patchDelivery = async (req, res) => {
  await service.expireOverdue();
  const body = req.body || {};
  const job = body.action === 'switch_to_pickup'
    ? await service.switchToPickup(req.params.id, body.student_id)
    : await service.act(req.params.id, body);
  res.json(job);
};

// GET /api/deliveries/:id/location -> { status, location: { lat, lng, accuracy, at } | null }
exports.getLocation = async (req, res) => {
  res.json(await service.getLocation(req.params.id));
};

// PUT /api/deliveries/:id/location  { "courier_id": "<profile id>", "lat": 1.29, "lng": 103.85, "accuracy": 12 }
exports.putLocation = async (req, res) => {
  res.json(await service.saveLocation(req.params.id, req.body));
};
