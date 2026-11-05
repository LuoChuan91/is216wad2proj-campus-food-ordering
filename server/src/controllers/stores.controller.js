
const service = require('../services/stores.service');
const analyticsService = require('../services/analytics.service');

exports.listStores = async (req, res) => {
  const stores = await service.listStores({ venueId: req.query.venue_id });
  res.json(stores);
};

exports.getStore = async (req, res) => {
  const store = await service.getStore(req.params.id);
  res.json(store);
};

exports.getAnalytics = async (req, res) => {
  const analytics = await analyticsService.getStoreAnalytics(req.params.id, { from: req.query.from, to: req.query.to }, req.get('x-user-id'));
  res.json(analytics);
};

exports.updateStore = async (req, res) => {
  const store = await service.updateStore(req.params.id, req.body, req.get('x-user-id'));
  res.json(store);
};
