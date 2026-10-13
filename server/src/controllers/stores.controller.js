
const service = require('../services/stores.service');

exports.listStores = async (req, res) => {
  const stores = await service.listStores({ venueId: req.query.venue_id });
  res.json(stores);
};

exports.getStore = async (req, res) => {
  const store = await service.getStore(req.params.id);
  res.json(store);
};

exports.updateStore = async (req, res) => {
  const store = await service.updateStore(req.params.id, req.body);
  res.json(store);
};
