
const repository = require('../models/menu.repository');

exports.getMenuItem = async (id) => {
  const item = await repository.findItemWithOptions(id);
  if (!item || item.is_archived) { // archived = removed from the menu
    const err = new Error('Menu item not found');
    err.status = 404;
    throw err;
  }
  return item;
};
