
const repository = require('../models/menu.repository');

exports.getMenuItem = async (id) => {
  const item = await repository.findItemWithOptions(id);
  if (!item) {
    const err = new Error('Menu item not found');
    err.status = 404;
    throw err;
  }
  return item;
};
