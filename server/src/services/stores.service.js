
const repository = require('../models/stores.repository');

// The columns a PATCH may change (anything else in the body is ignored)
const EDITABLE = ['is_open', 'description', 'open_hours', 'image_url', 'discount_type', 'discount_per', 'discount_dol'];

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

exports.updateStore = async (id, changes = {}) => {
  await exports.getStore(id);
  const allowed = Object.fromEntries(Object.entries(changes).filter(([key]) => EDITABLE.includes(key)));
  if (Object.keys(allowed).length === 0) {
    const err = new Error(`Nothing to change. You can change: ${EDITABLE.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return repository.update(id, allowed);
};
