
const repository = require('../models/menu.repository');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

exports.getMenuItem = async (id) => {
  const item = await repository.findItemWithOptions(id);
  if (!item || item.is_archived) { // archived = removed from the menu
    throw httpError(404, 'Menu item not found');
  }
  return item;
};

// Every dish on the menus (or one store's, with storeId), with option groups
exports.listMenu = ({ storeId }) => repository.findAll({ storeId });

// The merchant's sold-out switch
exports.updateMenuItem = async (id, body = {}) => {
  if (typeof body.available !== 'boolean') throw httpError(400, 'Send { "available": true } or { "available": false }');
  await exports.getMenuItem(id);
  return repository.updateItem(id, { available: body.available });
};

// Angel: cooking details for the wait-time estimate
exports.getCookingDetails = async (ids) => {
  ids = [...new Set(ids)];
  return repository.itemsCookingDetails(ids);
};
