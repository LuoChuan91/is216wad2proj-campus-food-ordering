// Business rules: validation, calculations, "not found" checks. No req/res, no DB code.
const repository = require('../models/stores.repository');

exports.listStores = ({ venueId }) => {
  return repository.findAll({ venueId });
};

exports.getStore = async (id) => {
  const store = await repository.findById(id);
  if (!store) {
    const err = new Error('Store not found');
    err.status = 404;
    throw err;
  }
  return store;
};

exports.updateStore = async (id, changes) => {
  await exports.getStore(id);
  return repository.update(id, changes);
};
